require 'spec_helper'
require 'securerandom'

RSpec.describe "SOAP Payments Acceptance Suite (R1-R16)" do
  let(:provider) { MockPayoutProvider.new }
  let(:service)  { WithdrawalService.new(payout_provider: provider) }

  def create_user(email: "user_#{SecureRandom.hex(4)}@example.com", balance_cents: 10_000)
    user = User.create!(email: email, balance_cents: balance_cents)
    LedgerEntry.create!(
      user: user,
      entry_type: 'deposit',
      amount_cents: balance_cents,
      reference: 'opening_balance',
      created_at: Time.current
    )
    user
  end

  def create_payment_method(user:, asset_class: 'fiat_card', token: "tok_#{SecureRandom.hex(6)}")
    PaymentMethod.create!(user: user, asset_class: asset_class, external_token: token)
  end

  def create_deposit(user:, payment_method:, amount_cents:, settled_at:)
    Deposit.create!(
      user: user,
      payment_method: payment_method,
      amount_cents: amount_cents,
      unrefunded_principal_cents: amount_cents,
      settled_at: settled_at
    )
  end

  # ==========================================
  # R1: FIFO single deposit
  # ==========================================
  it 'R1: refunds a single prior deposit back to its original instrument in FIFO order' do
    user = create_user(balance_cents: 10_000)
    card = create_payment_method(user: user, asset_class: 'fiat_card')
    ach  = create_payment_method(user: user, asset_class: 'fiat_ach')
    dep  = create_deposit(user: user, payment_method: card, amount_cents: 10_000, settled_at: 2.hours.ago)

    res = service.execute(
      user: user,
      amount_cents: 6_000,
      default_payout_method_id: ach.id,
      idempotency_key: "r1_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 6000 }
    )

    expect(res.status).to eq(:ok)
    expect(res.legs.size).to eq(1)

    leg = res.legs.first
    expect(leg.amount_cents).to eq(6_000)
    expect(leg.payment_method_id).to eq(card.id)

    expect(dep.reload.unrefunded_principal_cents).to eq(4_000)
    expect(user.reload.balance_cents).to eq(4_000)
  end

  # ==========================================
  # R2: FIFO split across deposits
  # ==========================================
  it 'R2: exhausts the oldest deposit before allocating to the next deposit' do
    user  = create_user(balance_cents: 10_000)
    card1 = create_payment_method(user: user, asset_class: 'fiat_card')
    card2 = create_payment_method(user: user, asset_class: 'fiat_card')
    ach   = create_payment_method(user: user, asset_class: 'fiat_ach')

    dep1 = create_deposit(user: user, payment_method: card1, amount_cents: 5_000, settled_at: 3.hours.ago)
    dep2 = create_deposit(user: user, payment_method: card2, amount_cents: 5_000, settled_at: 1.hour.ago)

    res = service.execute(
      user: user,
      amount_cents: 7_000,
      default_payout_method_id: ach.id,
      idempotency_key: "r2_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 7000 }
    )

    expect(res.status).to eq(:ok)
    expect(res.legs.size).to eq(2)

    expect(res.legs[0].amount_cents).to eq(5_000)
    expect(res.legs[0].payment_method_id).to eq(card1.id)

    expect(res.legs[1].amount_cents).to eq(2_000)
    expect(res.legs[1].payment_method_id).to eq(card2.id)

    expect(dep1.reload.unrefunded_principal_cents).to eq(0)
    expect(dep2.reload.unrefunded_principal_cents).to eq(3_000)
    expect(user.reload.balance_cents).to eq(3_000)
  end

  # ==========================================
  # R3: Excess to default payout
  # ==========================================
  it 'R3: routes only excess residual amount to default payout method after deposits are exhausted' do
    user = create_user(balance_cents: 10_000)
    card = create_payment_method(user: user, asset_class: 'fiat_card')
    ach  = create_payment_method(user: user, asset_class: 'fiat_ach')

    dep = create_deposit(user: user, payment_method: card, amount_cents: 4_000, settled_at: 2.hours.ago)

    res = service.execute(
      user: user,
      amount_cents: 7_000,
      default_payout_method_id: ach.id,
      idempotency_key: "r3_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 7000 }
    )

    expect(res.status).to eq(:ok)
    expect(res.legs.size).to eq(2)

    expect(res.legs[0].amount_cents).to eq(4_000)
    expect(res.legs[0].payment_method_id).to eq(card.id)

    expect(res.legs[1].amount_cents).to eq(3_000)
    expect(res.legs[1].payment_method_id).to eq(ach.id)

    expect(dep.reload.unrefunded_principal_cents).to eq(0)
    expect(user.reload.balance_cents).to eq(3_000)
  end

  # ==========================================
  # R4: Cross-asset refusal
  # ==========================================
  it 'R4: explicitly refuses cross-asset combinations (fiat ↔ crypto)' do
    user = create_user(balance_cents: 10_000)
    crypto_pm = create_payment_method(user: user, asset_class: 'crypto')
    fiat_pm   = create_payment_method(user: user, asset_class: 'fiat_card')

    create_deposit(user: user, payment_method: crypto_pm, amount_cents: 10_000, settled_at: 1.hour.ago)

    res = service.execute(
      user: user,
      amount_cents: 5_000,
      default_payout_method_id: fiat_pm.id,
      idempotency_key: "r4_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 5000 }
    )

    expect(res.status).to eq(:error)
    expect(res.code).to eq(:cross_asset_refused)
    expect(user.reload.balance_cents).to eq(10_000)
    expect(Withdrawal.count).to eq(0)
  end

  # ==========================================
  # R5: Payout ownership validation
  # ==========================================
  it 'R5: rejects payout method belonging to a different user' do
    user1 = create_user(balance_cents: 10_000)
    user2 = create_user(balance_cents: 10_000)
    other_pm = create_payment_method(user: user2, asset_class: 'fiat_card')

    res = service.execute(
      user: user1,
      amount_cents: 2_000,
      default_payout_method_id: other_pm.id,
      idempotency_key: "r5_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 2000 }
    )

    expect(res.status).to eq(:error)
    expect(res.code).to eq(:unauthorized_payout_method)
    expect(Withdrawal.count).to eq(0)
    expect(user1.reload.balance_cents).to eq(10_000)
  end

  # ==========================================
  # R6: Invalid amount validation
  # ==========================================
  it 'R6: rejects non-positive or non-integer amounts' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')

    [-100, 0, 12.34, "5000"].each do |bad_amount|
      res = service.execute(
        user: user,
        amount_cents: bad_amount,
        default_payout_method_id: pm.id,
        idempotency_key: "r6_key_#{SecureRandom.hex(4)}",
        request_body: { amount: bad_amount }
      )
      expect(res.status).to eq(:error)
      expect(res.code).to eq(:invalid_amount)
    end
  end

  # ==========================================
  # R7: Idempotent replay
  # ==========================================
  it 'R7: returns identical cached result on retry with same key and request body' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')
    key = "r7_key_#{SecureRandom.hex(4)}"
    body = { amount: 3000 }

    res1 = service.execute(
      user: user,
      amount_cents: 3_000,
      default_payout_method_id: pm.id,
      idempotency_key: key,
      request_body: body
    )
    expect(res1.status).to eq(:ok)
    w_id = res1.withdrawal_id

    res2 = service.execute(
      user: user,
      amount_cents: 3_000,
      default_payout_method_id: pm.id,
      idempotency_key: key,
      request_body: body
    )
    expect(res2.status).to eq(:ok)
    expect(res2.withdrawal_id).to eq(w_id)
    expect(Withdrawal.where(idempotency_key: key).count).to eq(1)
    expect(user.reload.balance_cents).to eq(7_000)
  end

  # ==========================================
  # R8: Idempotency conflict
  # ==========================================
  it 'R8: returns 409 conflict error when same key is reused with different request body' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')
    key = "r8_key_#{SecureRandom.hex(4)}"

    res1 = service.execute(
      user: user,
      amount_cents: 3_000,
      default_payout_method_id: pm.id,
      idempotency_key: key,
      request_body: { amount: 3000 }
    )
    expect(res1.status).to eq(:ok)

    res2 = service.execute(
      user: user,
      amount_cents: 4_000,
      default_payout_method_id: pm.id,
      idempotency_key: key,
      request_body: { amount: 4000 }
    )
    expect(res2.status).to eq(:error)
    expect(res2.code).to eq(:idempotency_conflict)
    expect(Withdrawal.count).to eq(1)
    expect(user.reload.balance_cents).to eq(7_000)
  end

  # ==========================================
  # R9: Concurrent withdrawal safety
  # ==========================================
  it 'R9: prevents overdraft under concurrent withdrawals and guarantees balance never goes negative' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')

    results = []
    threads = 2.times.map do |i|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          results << service.execute(
            user: user,
            amount_cents: 7_000,
            default_payout_method_id: pm.id,
            idempotency_key: "r9_key_#{i}_#{SecureRandom.hex(4)}",
            request_body: { amount: 7000, thread: i }
          )
        end
      end
    end
    threads.each(&:join)

    expect(user.reload.balance_cents).to be >= 0
    expect(Withdrawal.count).to eq(1)
    expect(results.count { |r| r.status == :ok }).to eq(1)
    expect(results.count { |r| r.status == :error && r.code == :insufficient_funds }).to eq(1)
  end

  # ==========================================
  # R10: Provider submitted outcome
  # ==========================================
  it 'R10: transitions leg to submitted without reversing ledger' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')
    MockPayoutProvider.set_next_response(status: :submitted, external_id: "ext_sub_10")

    res = service.execute(
      user: user,
      amount_cents: 5_000,
      default_payout_method_id: pm.id,
      idempotency_key: "r10_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 5000 }
    )

    expect(res.status).to eq(:ok)
    leg = res.legs.first
    expect(leg.state).to eq('submitted')
    expect(leg.external_id).to eq('ext_sub_10')
    expect(user.reload.balance_cents).to eq(5_000)
    expect(LedgerEntry.where(entry_type: 'withdrawal_reversal').count).to eq(0)
  end

  # ==========================================
  # R11: Provider failed outcome + exactly-once reversal
  # ==========================================
  it 'R11: creates exactly one compensating reversal entry and restores user balance on failed leg' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')
    MockPayoutProvider.set_next_response(status: :failed, external_id: "ext_fail_11", failure_code: "provider_error")

    res = service.execute(
      user: user,
      amount_cents: 4_000,
      default_payout_method_id: pm.id,
      idempotency_key: "r11_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 4000 }
    )

    expect(res.status).to eq(:ok)
    leg = res.legs.first
    expect(leg.state).to eq('failed')
    expect(leg.failure_code).to eq('provider_error')

    # Reversal created
    reversals = LedgerEntry.where(user: user, entry_type: 'withdrawal_reversal')
    expect(reversals.count).to eq(1)
    expect(reversals.first.amount_cents).to eq(4_000)

    # Balance restored back to initial 10,000
    expect(user.reload.balance_cents).to eq(10_000)
  end

  # ==========================================
  # R12: Provider unknown outcome
  # ==========================================
  it 'R12: stays non-terminal without reversing balance or retrying on unknown status' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')
    MockPayoutProvider.set_next_response(status: :unknown, external_id: "ext_unk_12")

    res = service.execute(
      user: user,
      amount_cents: 4_000,
      default_payout_method_id: pm.id,
      idempotency_key: "r12_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 4000 }
    )

    expect(res.status).to eq(:ok)
    leg = res.legs.first
    expect(leg.state).to eq('unknown')

    # Balance remains debited; no reversal created
    expect(user.reload.balance_cents).to eq(6_000)
    expect(LedgerEntry.where(entry_type: 'withdrawal_reversal').count).to eq(0)
  end

  # ==========================================
  # R13: Webhook replay safety
  # ==========================================
  it 'R13: duplicate webhook events are idempotent no-ops' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')
    MockPayoutProvider.set_next_response(status: :submitted, external_id: "ext_wh_13")

    res = service.execute(
      user: user,
      amount_cents: 3_000,
      default_payout_method_id: pm.id,
      idempotency_key: "r13_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 3000 }
    )
    expect(user.reload.balance_cents).to eq(7_000)

    handler = WithdrawalWebhookHandler.new
    event_payload = {
      external_event_id: "evt_13_#{SecureRandom.hex(4)}",
      event_type: 'payout.failed',
      external_id: 'ext_wh_13',
      failure_code: 'account_closed'
    }

    # First delivery: reverses
    handler.handle(event_payload)
    expect(user.reload.balance_cents).to eq(10_000)
    expect(LedgerEntry.where(entry_type: 'withdrawal_reversal').count).to eq(1)

    # Second delivery (replay): no-op
    handler.handle(event_payload)
    expect(user.reload.balance_cents).to eq(10_000)
    expect(LedgerEntry.where(entry_type: 'withdrawal_reversal').count).to eq(1)
  end

  # ==========================================
  # R14: Late failure after success / settled
  # ==========================================
  it 'R14: late failure after settled does not reverse funds' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')
    MockPayoutProvider.set_next_response(status: :submitted, external_id: "ext_wh_14")

    service.execute(
      user: user,
      amount_cents: 3_000,
      default_payout_method_id: pm.id,
      idempotency_key: "r14_key_#{SecureRandom.hex(4)}",
      request_body: { amount: 3000 }
    )
    expect(user.reload.balance_cents).to eq(7_000)

    handler = WithdrawalWebhookHandler.new

    # Leg settles
    handler.handle(
      external_event_id: "evt_14_settle",
      event_type: 'payout.settled',
      external_id: 'ext_wh_14'
    )
    leg = PayoutLeg.find_by(external_id: 'ext_wh_14')
    expect(leg.state).to eq('settled')

    # Late failure arrived: must not reverse
    handler.handle(
      external_event_id: "evt_14_late_fail",
      event_type: 'payout.failed',
      external_id: 'ext_wh_14'
    )

    expect(leg.reload.state).to eq('settled')
    expect(user.reload.balance_cents).to eq(7_000)
    expect(LedgerEntry.where(entry_type: 'withdrawal_reversal').count).to eq(0)
  end

  # ==========================================
  # R15: Ledger reconciliation
  # ==========================================
  it 'R15: sum of ledger entry deltas always equals the user balance' do
    user = create_user(balance_cents: 10_000)
    pm = create_payment_method(user: user, asset_class: 'fiat_card')

    # 1. First withdrawal: submitted
    MockPayoutProvider.set_next_response(status: :submitted)
    service.execute(
      user: user,
      amount_cents: 2_000,
      default_payout_method_id: pm.id,
      idempotency_key: "r15_k1",
      request_body: { amount: 2000 }
    )
    expect(user.reload.balance_cents).to eq(user.ledger_entries.sum(:amount_cents))

    # 2. Second withdrawal: failed with reversal
    MockPayoutProvider.set_next_response(status: :failed)
    service.execute(
      user: user,
      amount_cents: 3_000,
      default_payout_method_id: pm.id,
      idempotency_key: "r15_k2",
      request_body: { amount: 3000 }
    )
    expect(user.reload.balance_cents).to eq(user.ledger_entries.sum(:amount_cents))
  end

  # ==========================================
  # R16: Ledger immutability
  # ==========================================
  it 'R16: raises and prevents update or deletion of ledger entries' do
    user = create_user(balance_cents: 5_000)
    entry = user.ledger_entries.first

    expect {
      entry.update!(amount_cents: 99_999)
    }.to raise_error(ActiveRecord::ReadOnlyRecord)

    expect {
      entry.destroy!
    }.to raise_error(ActiveRecord::ReadOnlyRecord)

    expect(entry.reload.amount_cents).to eq(5_000)
  end
end
