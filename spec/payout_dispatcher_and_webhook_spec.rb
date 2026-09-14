require 'spec_helper'
require 'securerandom'

RSpec.describe 'PayoutDispatcher and WithdrawalWebhookHandler' do
  def create_user(email: "user_#{SecureRandom.hex(4)}@example.com", balance_cents: 10_000)
    User.create!(email: email, balance_cents: balance_cents)
  end

  def create_pm(user:, asset_class: 'fiat_card')
    PaymentMethod.create!(user: user, asset_class: asset_class, external_token: "tok_#{SecureRandom.hex(6)}")
  end

  it 'PayoutDispatcher handles mock provider exceptions gracefully by recording unknown' do
    broken_provider = Object.new
    def broken_provider.dispatch(**)
      raise "Network timeout"
    end

    user = create_user(balance_cents: 5000)
    pm = create_pm(user: user)
    withdrawal = Withdrawal.create!(user: user, amount_cents: 2000, state: 'pending', idempotency_key: "brk_#{SecureRandom.hex(4)}", request_fingerprint: "fp")
    leg = PayoutLeg.create!(withdrawal: withdrawal, payment_method: pm, amount_cents: 2000, state: 'pending')

    dispatcher = PayoutDispatcher.new(payout_provider: broken_provider)
    dispatcher.dispatch(leg)

    expect(leg.reload.state).to eq('unknown')
    expect(LedgerEntry.where(entry_type: 'withdrawal_reversal').count).to eq(0)
  end

  it 'WithdrawalWebhookHandler correctly parses JSON string payload in WebhookEvent' do
    user = create_user(balance_cents: 5000)
    pm = create_pm(user: user)
    withdrawal = Withdrawal.create!(user: user, amount_cents: 2000, state: 'submitted', idempotency_key: "wh_#{SecureRandom.hex(4)}", request_fingerprint: "fp")
    leg = PayoutLeg.create!(withdrawal: withdrawal, payment_method: pm, amount_cents: 2000, state: 'submitted', external_id: "ext_wh_json")

    handler = WithdrawalWebhookHandler.new
    event = WebhookEvent.create!(
      external_event_id: "evt_json_1",
      event_type: "payout.failed",
      payload: { external_id: "ext_wh_json", status: "failed", failure_code: "invalid_account" }.to_json
    )

    handler.handle(event)

    expect(leg.reload.state).to eq('failed')
    expect(leg.failure_code).to eq('invalid_account')
    expect(user.reload.balance_cents).to eq(7000)
    expect(event.reload.processed_at).not_to be_nil
  end

  it 'WithdrawalWebhookHandler transitions withdrawal to settled when all legs settle' do
    user = create_user(balance_cents: 5000)
    pm1 = create_pm(user: user)
    pm2 = create_pm(user: user)
    withdrawal = Withdrawal.create!(user: user, amount_cents: 3000, state: 'submitted', idempotency_key: "wh_all_#{SecureRandom.hex(4)}", request_fingerprint: "fp")
    leg1 = PayoutLeg.create!(withdrawal: withdrawal, payment_method: pm1, amount_cents: 2000, state: 'submitted', external_id: "ext_leg_1")
    leg2 = PayoutLeg.create!(withdrawal: withdrawal, payment_method: pm2, amount_cents: 1000, state: 'submitted', external_id: "ext_leg_2")

    handler = WithdrawalWebhookHandler.new

    handler.handle(external_event_id: "evt_leg1", event_type: "payout.settled", external_id: "ext_leg_1")
    expect(withdrawal.reload.state).to eq('submitted') # leg2 not yet settled

    handler.handle(external_event_id: "evt_leg2", event_type: "payout.settled", external_id: "ext_leg_2")
    expect(withdrawal.reload.state).to eq('settled') # all legs settled
  end
end
