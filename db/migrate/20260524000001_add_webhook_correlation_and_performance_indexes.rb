# frozen_string_literal: true

class AddWebhookCorrelationAndPerformanceIndexes < ActiveRecord::Migration[7.1]
  def change
    add_index :payout_legs, :external_id
    add_reference :webhook_events, :payout_leg, foreign_key: true, index: true
    add_index :withdrawals, :state
    add_index :withdrawals, :created_at
  end
end
