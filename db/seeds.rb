# frozen_string_literal: true

# db/seeds.rb — Deterministic Sandbox Seed Data for SOAP Payments
# Populates realistic demo users, payment methods, deposits, withdrawals,
# payout legs, ledger entries, and webhook events satisfying all domain invariants.

require 'active_record'
require 'securerandom'

app_root = File.expand_path('..', __dir__)
$LOAD_PATH.unshift app_root unless $LOAD_PATH.include?(app_root)
Dir[File.expand_path('../app/models/*.rb', __dir__)].sort.each { |f| require f }
Dir[File.expand_path('../app/services/*.rb', __dir__)].sort.each { |f| require f }

puts '== Seeding SOAP Payments Sandbox Database =='

# Ensure tables are clean for deterministic seeding
ActiveRecord::Base.transaction do
  # Truncate tables with cascade
  tables = %w[payout_legs withdrawals deposits ledger_entries payment_methods users webhook_events idempotency_keys]
  ActiveRecord::Base.connection.execute(
    "TRUNCATE TABLE #{tables.map { |t| ActiveRecord::Base.connection.quote_table_name(t) }.join(', ')} RESTART IDENTITY CASCADE"
  )

  # --------------------------------------------------
  # 1. USER: Aarav Mehta (Primary Simulator Showcase)
  # --------------------------------------------------
  # Target: Balance ₹10,000. Deposits: 3k Visa + 2k UPI + 1.5k Mastercard + 3.5k initial credit = 10k.
  # Ready to simulate ₹8k withdrawal -> 3k Visa + 2k UPI + 1.5k MC + 1.5k Bank residual.
  aarav = User.create!(
    email: 'aarav.mehta@soapdemo.com',
    balance_cents: 10_000_00 # ₹10,000 in minor units (cents)
  )

  pm_aarav_visa = PaymentMethod.create!(
    user: aarav,
    asset_class: 'fiat_card',
    external_token: 'card_visa_4242'
  )
  pm_aarav_upi = PaymentMethod.create!(
    user: aarav,
    asset_class: 'fiat_card',
    external_token: 'upi_googlepay_8888'
  )
  pm_aarav_mc = PaymentMethod.create!(
    user: aarav,
    asset_class: 'fiat_card',
    external_token: 'card_mastercard_5555'
  )
  pm_aarav_bank = PaymentMethod.create!(
    user: aarav,
    asset_class: 'fiat_ach',
    external_token: 'bank_axis_9876'
  )

  dep_aarav_1 = Deposit.create!(
    user: aarav,
    payment_method: pm_aarav_visa,
    amount_cents: 3_000_00,
    unrefunded_principal_cents: 3_000_00,
    settled_at: 4.days.ago
  )
  dep_aarav_2 = Deposit.create!(
    user: aarav,
    payment_method: pm_aarav_upi,
    amount_cents: 2_000_00,
    unrefunded_principal_cents: 2_000_00,
    settled_at: 3.days.ago
  )
  dep_aarav_3 = Deposit.create!(
    user: aarav,
    payment_method: pm_aarav_mc,
    amount_cents: 1_500_00,
    unrefunded_principal_cents: 1_500_00,
    settled_at: 2.days.ago
  )

  LedgerEntry.create!(user: aarav, entry_type: 'deposit', amount_cents: 3_000_00, reference: "dep:#{dep_aarav_1.id}", created_at: 4.days.ago)
  LedgerEntry.create!(user: aarav, entry_type: 'deposit', amount_cents: 2_000_00, reference: "dep:#{dep_aarav_2.id}", created_at: 3.days.ago)
  LedgerEntry.create!(user: aarav, entry_type: 'deposit', amount_cents: 1_500_00, reference: "dep:#{dep_aarav_3.id}", created_at: 2.days.ago)
  LedgerEntry.create!(user: aarav, entry_type: 'adjustment', amount_cents: 3_500_00, reference: 'sandbox_initial_credit', created_at: 5.days.ago)

  # --------------------------------------------------
  # 2. USER: Priya Sharma (Multi-Withdrawal History)
  # --------------------------------------------------
  # Initial balance was ₹35,000, deposited ₹35,000.
  # Withdrew ₹10,000 (settled), leaving ₹25,000 balance.
  priya = User.create!(
    email: 'priya.sharma@soapdemo.com',
    balance_cents: 25_000_00
  )

  pm_priya_hdfc = PaymentMethod.create!(
    user: priya,
    asset_class: 'fiat_ach',
    external_token: 'bank_hdfc_4321'
  )
  pm_priya_visa = PaymentMethod.create!(
    user: priya,
    asset_class: 'fiat_card',
    external_token: 'card_visa_1111'
  )

  dep_priya_1 = Deposit.create!(
    user: priya,
    payment_method: pm_priya_visa,
    amount_cents: 20_000_00,
    unrefunded_principal_cents: 10_000_00, # 10k was refunded in previous withdrawal
    settled_at: 6.days.ago
  )
  dep_priya_2 = Deposit.create!(
    user: priya,
    payment_method: pm_priya_hdfc,
    amount_cents: 15_000_00,
    unrefunded_principal_cents: 15_000_00,
    settled_at: 5.days.ago
  )

  LedgerEntry.create!(user: priya, entry_type: 'deposit', amount_cents: 20_000_00, reference: "dep:#{dep_priya_1.id}", created_at: 6.days.ago)
  LedgerEntry.create!(user: priya, entry_type: 'deposit', amount_cents: 15_000_00, reference: "dep:#{dep_priya_2.id}", created_at: 5.days.ago)

  # Pre-seeded settled withdrawal for Priya
  wd_priya_1 = Withdrawal.create!(
    user: priya,
    amount_cents: 10_000_00,
    state: 'settled',
    idempotency_key: 'demo_priya_wd_settled_001',
    request_fingerprint: 'fp_priya_001',
    created_at: 3.days.ago,
    updated_at: 3.days.ago + 10.minutes
  )
  leg_priya_1 = PayoutLeg.create!(
    withdrawal: wd_priya_1,
    payment_method: pm_priya_visa,
    amount_cents: 10_000_00,
    state: 'settled',
    external_id: 'ext_priya_leg_1',
    created_at: 3.days.ago,
    updated_at: 3.days.ago + 10.minutes
  )
  LedgerEntry.create!(
    user: priya,
    entry_type: 'withdrawal_debit',
    amount_cents: -10_000_00,
    reference: "withdrawal:#{wd_priya_1.id}",
    created_at: 3.days.ago
  )

  WebhookEvent.create!(
    external_event_id: 'evt_wh_priya_settled_1',
    event_type: 'payout.settled',
    payload: { external_id: 'ext_priya_leg_1', status: 'settled', amount_cents: 10_000_00 }.to_json,
    processed_at: 3.days.ago + 10.minutes,
    created_at: 3.days.ago + 10.minutes
  )

  # --------------------------------------------------
  # 3. USER: Rohit Verma (Cross-Asset Showcase)
  # --------------------------------------------------
  # Balance ₹15,000 from crypto deposit. Default payout is fiat ACH.
  # Shows cross-asset invariant enforcement when trying to withdraw excess!
  rohit = User.create!(
    email: 'rohit.verma@soapdemo.com',
    balance_cents: 15_000_00
  )

  pm_rohit_crypto = PaymentMethod.create!(
    user: rohit,
    asset_class: 'crypto',
    external_token: 'wallet_eth_0x71c'
  )
  pm_rohit_bank = PaymentMethod.create!(
    user: rohit,
    asset_class: 'fiat_ach',
    external_token: 'bank_sbi_7777'
  )

  dep_rohit_1 = Deposit.create!(
    user: rohit,
    payment_method: pm_rohit_crypto,
    amount_cents: 15_000_00,
    unrefunded_principal_cents: 15_000_00,
    settled_at: 2.days.ago
  )
  LedgerEntry.create!(user: rohit, entry_type: 'deposit', amount_cents: 15_000_00, reference: "dep:#{dep_rohit_1.id}", created_at: 2.days.ago)

  # --------------------------------------------------
  # 4. USER: Kavya Nair (Failure & Reversal Showcase)
  # --------------------------------------------------
  # Deposited ₹5,000. Made a withdrawal of ₹2,000 which failed at provider.
  # Compensating reversal restored the ₹2,000. Balance = ₹5,000.
  kavya = User.create!(
    email: 'kavya.nair@soapdemo.com',
    balance_cents: 5_000_00
  )

  pm_kavya_icici = PaymentMethod.create!(
    user: kavya,
    asset_class: 'fiat_ach',
    external_token: 'bank_icici_5555'
  )

  dep_kavya_1 = Deposit.create!(
    user: kavya,
    payment_method: pm_kavya_icici,
    amount_cents: 5_000_00,
    unrefunded_principal_cents: 5_000_00,
    settled_at: 4.days.ago
  )
  LedgerEntry.create!(user: kavya, entry_type: 'deposit', amount_cents: 5_000_00, reference: "dep:#{dep_kavya_1.id}", created_at: 4.days.ago)

  wd_kavya_fail = Withdrawal.create!(
    user: kavya,
    amount_cents: 2_000_00,
    state: 'failed',
    idempotency_key: 'demo_kavya_wd_failed_001',
    request_fingerprint: 'fp_kavya_001',
    created_at: 1.day.ago,
    updated_at: 1.day.ago + 5.minutes
  )
  leg_kavya_fail = PayoutLeg.create!(
    withdrawal: wd_kavya_fail,
    payment_method: pm_kavya_icici,
    amount_cents: 2_000_00,
    state: 'failed',
    failure_code: 'insufficient_partner_liquidity',
    external_id: 'ext_kavya_fail_1',
    created_at: 1.day.ago,
    updated_at: 1.day.ago + 5.minutes
  )
  LedgerEntry.create!(
    user: kavya,
    entry_type: 'withdrawal_debit',
    amount_cents: -2_000_00,
    reference: "withdrawal:#{wd_kavya_fail.id}",
    created_at: 1.day.ago
  )
  LedgerEntry.create!(
    user: kavya,
    entry_type: 'withdrawal_reversal',
    amount_cents: 2_000_00,
    reference: "payout_leg:#{leg_kavya_fail.id}:reversal",
    created_at: 1.day.ago + 5.minutes
  )

  WebhookEvent.create!(
    external_event_id: 'evt_wh_kavya_failed_1',
    event_type: 'payout.failed',
    payload: { external_id: 'ext_kavya_fail_1', status: 'failed', failure_code: 'insufficient_partner_liquidity' }.to_json,
    processed_at: 1.day.ago + 5.minutes,
    created_at: 1.day.ago + 5.minutes
  )
end

puts '== Sandbox Seed Completed Successfully =='
puts "Users: #{User.count}"
puts "Payment Methods: #{PaymentMethod.count}"
puts "Deposits: #{Deposit.count}"
puts "Withdrawals: #{Withdrawal.count}"
puts "Payout Legs: #{PayoutLeg.count}"
puts "Ledger Entries: #{LedgerEntry.count}"
puts "Webhook Events: #{WebhookEvent.count}"

# Verify reconciliation
mismatches = 0
User.find_each do |u|
  l_sum = u.ledger_entries.sum(:amount_cents)
  if l_sum != u.balance_cents
    puts "ERROR: Reconciliation mismatch for #{u.email}: balance=#{u.balance_cents}, ledger=#{l_sum}"
    mismatches += 1
  end
end

if mismatches.zero?
  puts '✓ All User balances 100% reconciled with append-only ledger!'
else
  raise "Seed failed with #{mismatches} reconciliation mismatches"
end
