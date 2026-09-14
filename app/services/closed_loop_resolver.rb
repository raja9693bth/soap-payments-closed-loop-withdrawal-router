# ClosedLoopResolver — given a user + a withdrawal amount, produce the
# ordered list of PlanEntry rows that the withdrawal should produce.
class ClosedLoopResolver
  class Error < StandardError; end
  class InvalidAmountError < Error; end
  class PayoutOwnershipError < Error; end
  class PayoutNotFoundError < Error; end
  class CrossAssetError < Error; end

  PlanEntry = Struct.new(:payment_method_id, :amount_cents, :source, keyword_init: true)

  def resolve(user:, amount_cents:, default_payout_method_id:, lock: false)
    raise InvalidAmountError, "Amount must be a positive integer" unless amount_cents.is_a?(Integer) && amount_cents > 0

    default_payout_method = PaymentMethod.find_by(id: default_payout_method_id)
    raise PayoutNotFoundError, "Default payout method not found" unless default_payout_method
    raise PayoutOwnershipError, "Default payout method does not belong to user" unless default_payout_method.user_id == user.id

    target_family = asset_family_for(default_payout_method)

    # Query candidate deposits for user with unrefunded principal
    deposit_scope = Deposit.where(user_id: user.id)
                           .where("unrefunded_principal_cents > 0")
                           .order(settled_at: :asc, id: :asc)

    deposit_scope = deposit_scope.lock("FOR UPDATE") if lock
    all_deposits = deposit_scope.includes(:payment_method).to_a

    eligible_deposits = []
    conflicting_deposits = []

    all_deposits.each do |dep|
      if asset_family_for(dep.payment_method) == target_family
        eligible_deposits << dep
      else
        conflicting_deposits << dep
      end
    end

    total_eligible_principal = eligible_deposits.sum(&:unrefunded_principal_cents)
    total_conflicting_principal = conflicting_deposits.sum(&:unrefunded_principal_cents)

    # Cross-asset refusal invariant:
    # If eligible deposits cannot cover the withdrawal, and user has conflicting unrefunded deposits,
    # routing the excess to the default payout method would cross asset families.
    if amount_cents > total_eligible_principal && total_conflicting_principal > 0
      raise CrossAssetError, "Withdrawal requires crossing asset families between deposits and payout method"
    end

    remaining = amount_cents
    plan = []

    eligible_deposits.each do |dep|
      break if remaining == 0

      take = [dep.unrefunded_principal_cents, remaining].min
      next if take <= 0

      plan << PlanEntry.new(
        payment_method_id: dep.payment_method_id,
        amount_cents: take,
        source: dep
      )
      remaining -= take
    end

    if remaining > 0
      plan << PlanEntry.new(
        payment_method_id: default_payout_method.id,
        amount_cents: remaining,
        source: :default_payout
      )
    end

    plan
  end

  private

  def asset_family_for(payment_method)
    return :crypto if payment_method.asset_class == 'crypto'
    :fiat
  end
end
