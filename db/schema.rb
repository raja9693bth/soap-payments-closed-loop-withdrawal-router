# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_05_23_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "deposits", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "payment_method_id", null: false
    t.bigint "amount_cents", null: false
    t.bigint "unrefunded_principal_cents", null: false
    t.datetime "settled_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["payment_method_id"], name: "index_deposits_on_payment_method_id"
    t.index ["user_id", "settled_at"], name: "index_deposits_on_user_id_and_settled_at"
    t.index ["user_id"], name: "index_deposits_on_user_id"
  end

  create_table "idempotency_keys", force: :cascade do |t|
    t.string "key", null: false
    t.string "request_fingerprint", null: false
    t.text "response_body", null: false
    t.integer "response_status", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_idempotency_keys_on_key", unique: true
  end

  create_table "ledger_entries", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "entry_type", null: false
    t.bigint "amount_cents", null: false
    t.string "reference", null: false
    t.datetime "created_at", null: false
    t.index ["user_id", "created_at"], name: "index_ledger_entries_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_ledger_entries_on_user_id"
  end

  create_table "payment_methods", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "asset_class", null: false
    t.string "external_token", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_payment_methods_on_user_id"
  end

  create_table "payout_legs", force: :cascade do |t|
    t.bigint "withdrawal_id", null: false
    t.bigint "payment_method_id", null: false
    t.bigint "amount_cents", null: false
    t.string "state", default: "pending", null: false
    t.string "external_id"
    t.string "failure_code"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["payment_method_id"], name: "index_payout_legs_on_payment_method_id"
    t.index ["withdrawal_id"], name: "index_payout_legs_on_withdrawal_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", null: false
    t.bigint "balance_cents", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  create_table "webhook_events", force: :cascade do |t|
    t.string "external_event_id", null: false
    t.string "event_type", null: false
    t.text "payload", null: false
    t.datetime "processed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["external_event_id"], name: "index_webhook_events_on_external_event_id", unique: true
  end

  create_table "withdrawals", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "amount_cents", null: false
    t.string "state", default: "pending", null: false
    t.string "idempotency_key", null: false
    t.string "request_fingerprint", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["idempotency_key"], name: "index_withdrawals_on_idempotency_key", unique: true
    t.index ["user_id"], name: "index_withdrawals_on_user_id"
  end

  add_foreign_key "deposits", "payment_methods"
  add_foreign_key "deposits", "users"
  add_foreign_key "ledger_entries", "users"
  add_foreign_key "payment_methods", "users"
  add_foreign_key "payout_legs", "payment_methods"
  add_foreign_key "payout_legs", "withdrawals"
  add_foreign_key "withdrawals", "users"
end
