require 'spec_helper'
require 'securerandom'

RSpec.describe ClosedLoopResolver do
  let(:resolver) { described_class.new }

  def create_user(email: "user_#{SecureRandom.hex(4)}@example.com", balance_cents: 10_000)
    User.create!(email: email, balance_cents: balance_cents)
  end

  def create_pm(user:, asset_class: 'fiat_card')
    PaymentMethod.create!(user: user, asset_class: asset_class, external_token: "tok_#{SecureRandom.hex(6)}")
  end

  def create_dep(user:, pm:, amount_cents:, unrefunded_cents:, settled_at:)
    Deposit.create!(
      user: user,
      payment_method: pm,
      amount_cents: amount_cents,
      unrefunded_principal_cents: unrefunded_cents,
      settled_at: settled_at
    )
  end

  it 'ignores fully refunded deposits (unrefunded_principal_cents == 0)' do
    user = create_user
    pm1 = create_pm(user: user)
    pm2 = create_pm(user: user)
    default_pm = create_pm(user: user)

    create_dep(user: user, pm: pm1, amount_cents: 5000, unrefunded_cents: 0, settled_at: 2.hours.ago)
    create_dep(user: user, pm: pm2, amount_cents: 5000, unrefunded_cents: 3000, settled_at: 1.hour.ago)

    plan = resolver.resolve(user: user, amount_cents: 3000, default_payout_method_id: default_pm.id)
    expect(plan.size).to eq(1)
    expect(plan.first.payment_method_id).to eq(pm2.id)
    expect(plan.first.amount_cents).to eq(3000)
  end

  it 'breaks ties deterministically by deposit id when settled_at is identical' do
    user = create_user
    pm1 = create_pm(user: user)
    pm2 = create_pm(user: user)
    default_pm = create_pm(user: user)
    t = 2.hours.ago

    d1 = create_dep(user: user, pm: pm1, amount_cents: 5000, unrefunded_cents: 5000, settled_at: t)
    d2 = create_dep(user: user, pm: pm2, amount_cents: 5000, unrefunded_cents: 5000, settled_at: t)

    plan = resolver.resolve(user: user, amount_cents: 6000, default_payout_method_id: default_pm.id)
    expect(plan.size).to eq(2)
    expect(plan[0].payment_method_id).to eq(d1.payment_method_id)
    expect(plan[0].amount_cents).to eq(5000)
    expect(plan[1].payment_method_id).to eq(d2.payment_method_id)
    expect(plan[1].amount_cents).to eq(1000)
  end

  it 'routes entirely to default payout when user has no prior deposits' do
    user = create_user
    default_pm = create_pm(user: user)

    plan = resolver.resolve(user: user, amount_cents: 4000, default_payout_method_id: default_pm.id)
    expect(plan.size).to eq(1)
    expect(plan.first.payment_method_id).to eq(default_pm.id)
    expect(plan.first.amount_cents).to eq(4000)
    expect(plan.first.source).to eq(:default_payout)
  end

  it 'raises PayoutNotFoundError when default payout method does not exist' do
    user = create_user
    expect {
      resolver.resolve(user: user, amount_cents: 1000, default_payout_method_id: -999)
    }.to raise_error(ClosedLoopResolver::PayoutNotFoundError)
  end

  describe 'same-asset closed-loop routing and cross-asset refusal' do
    it 'allocates only from matching asset deposits and ignores conflicting asset deposits' do
      user = create_user
      fiat_pm = create_pm(user: user, asset_class: 'fiat_card')
      crypto_pm = create_pm(user: user, asset_class: 'crypto')
      default_fiat_pm = create_pm(user: user, asset_class: 'fiat_ach')

      create_dep(user: user, pm: fiat_pm, amount_cents: 6000, unrefunded_cents: 6000, settled_at: 2.hours.ago)
      create_dep(user: user, pm: crypto_pm, amount_cents: 6000, unrefunded_cents: 6000, settled_at: 1.hour.ago)

      # 6000 withdrawal against fiat payout method: only fiat deposit contributes; crypto contributes 0
      plan = resolver.resolve(user: user, amount_cents: 6000, default_payout_method_id: default_fiat_pm.id)
      expect(plan.size).to eq(1)
      expect(plan.first.payment_method_id).to eq(fiat_pm.id)
      expect(plan.first.amount_cents).to eq(6000)
      expect(plan.none? { |e| e.payment_method_id == crypto_pm.id }).to be(true)
    end

    it 'refuses withdrawal when amount exceeds eligible deposits and conflicting asset deposits exist' do
      user = create_user
      fiat_pm = create_pm(user: user, asset_class: 'fiat_card')
      crypto_pm = create_pm(user: user, asset_class: 'crypto')
      default_fiat_pm = create_pm(user: user, asset_class: 'fiat_ach')

      create_dep(user: user, pm: fiat_pm, amount_cents: 6000, unrefunded_cents: 6000, settled_at: 2.hours.ago)
      create_dep(user: user, pm: crypto_pm, amount_cents: 6000, unrefunded_cents: 6000, settled_at: 1.hour.ago)

      # 10000 withdrawal requires 4000 excess, but conflicting crypto deposits exist -> CrossAssetError
      expect {
        resolver.resolve(user: user, amount_cents: 10_000, default_payout_method_id: default_fiat_pm.id)
      }.to raise_error(ClosedLoopResolver::CrossAssetError, /crossing asset families/)
    end

    it 'refuses withdrawal when only conflicting asset deposits exist for the payout method' do
      user = create_user
      crypto_pm = create_pm(user: user, asset_class: 'crypto')
      default_fiat_pm = create_pm(user: user, asset_class: 'fiat_ach')

      create_dep(user: user, pm: crypto_pm, amount_cents: 10_000, unrefunded_cents: 10_000, settled_at: 1.hour.ago)

      expect {
        resolver.resolve(user: user, amount_cents: 10_000, default_payout_method_id: default_fiat_pm.id)
      }.to raise_error(ClosedLoopResolver::CrossAssetError)
    end
  end
end
