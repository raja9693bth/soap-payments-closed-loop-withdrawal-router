# Initial schema for the closed-loop withdrawal router.
#
# This migration ships pre-applied; the candidate does NOT need to write
# migrations. If you change the schema as part of solving the task, write a
# new migration alongside this one (don't edit this file).
class CreateInitialSchema < ActiveRecord::Migration[7.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.bigint :balance_cents, null: false, default: 0
      t.timestamps
    end
    add_index :users, :email, unique: true

    create_table :payment_methods do |t|
      t.references :user, null: false, foreign_key: true
      # Asset class: 'fiat_card', 'fiat_ach', 'crypto'
      t.string :asset_class, null: false
      # External tokenized handle (we never store PANs)
      t.string :external_token, null: false
      t.timestamps
    end

    create_table :deposits do |t|
      t.references :user, null: false, foreign_key: true
      t.references :payment_method, null: false, foreign_key: true
      t.bigint :amount_cents, null: false
      # Principal that has not yet been refunded via prior withdrawals.
      # When this hits 0, the deposit no longer counts toward closed-loop.
      t.bigint :unrefunded_principal_cents, null: false
      t.datetime :settled_at, null: false
      t.timestamps
    end
    add_index :deposits, [:user_id, :settled_at]

    create_table :withdrawals do |t|
      t.references :user, null: false, foreign_key: true
      t.bigint :amount_cents, null: false
      # State machine: 'pending' | 'submitted' | 'settled' | 'failed'
      # (You may invent additional states if your design needs them.)
      t.string :state, null: false, default: 'pending'
      t.string :idempotency_key, null: false
      # Sha256 fingerprint of the request body, used to detect key reuse
      # with mismatched params.
      t.string :request_fingerprint, null: false
      t.timestamps
    end
    add_index :withdrawals, :idempotency_key, unique: true

    create_table :payout_legs do |t|
      t.references :withdrawal, null: false, foreign_key: true
      t.references :payment_method, null: false, foreign_key: true
      t.bigint :amount_cents, null: false
      t.string :state, null: false, default: 'pending'
      t.string :external_id
      t.string :failure_code
      t.timestamps
    end

    create_table :ledger_entries do |t|
      t.references :user, null: false, foreign_key: true
      # 'deposit' | 'withdrawal_debit' | 'withdrawal_reversal' | 'adjustment'
      t.string :entry_type, null: false
      # Signed integer cents. Credits positive, debits negative.
      t.bigint :amount_cents, null: false
      # Free-text reference back to the originating object (e.g. 'withdrawal:42').
      t.string :reference, null: false
      t.datetime :created_at, null: false
    end
    add_index :ledger_entries, [:user_id, :created_at]

    create_table :idempotency_keys do |t|
      t.string :key, null: false
      t.string :request_fingerprint, null: false
      # Cached response body (JSON-encoded) returned on duplicate requests.
      t.text :response_body, null: false
      t.integer :response_status, null: false
      t.timestamps
    end
    add_index :idempotency_keys, :key, unique: true

    create_table :webhook_events do |t|
      t.string :external_event_id, null: false
      t.string :event_type, null: false
      t.text :payload, null: false
      t.datetime :processed_at
      t.timestamps
    end
    add_index :webhook_events, :external_event_id, unique: true
  end
end
