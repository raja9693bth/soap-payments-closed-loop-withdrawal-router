# PayoutDispatcher — calls the payout provider for a leg and updates the
# leg row based on the response. Construct one per WithdrawalService instance.
class PayoutDispatcher
  def initialize(payout_provider:)
    @payout_provider = payout_provider
  end

  def dispatch(payout_leg)
    idempotency_key = "#{payout_leg.withdrawal.idempotency_key}:leg:#{payout_leg.id}"

    response = begin
      @payout_provider.dispatch(
        amount_cents: payout_leg.amount_cents,
        payment_method_id: payout_leg.payment_method_id,
        idempotency_key: idempotency_key
      )
    rescue StandardError => e
      { status: :unknown, external_id: nil, failure_code: nil }
    end

    apply_provider_result!(payout_leg, response)
  end

  private

  def apply_provider_result!(payout_leg, response)
    status = response[:status]&.to_sym
    external_id = response[:external_id]
    failure_code = response[:failure_code]

    case status
    when :submitted
      payout_leg.update!(
        state: 'submitted',
        external_id: external_id,
        failure_code: nil
      )
    when :failed
      payout_leg.update!(
        state: 'failed',
        external_id: external_id,
        failure_code: failure_code
      )
      compensate_failed_leg!(payout_leg)
    when :unknown
      payout_leg.update!(
        state: 'unknown',
        external_id: external_id,
        failure_code: nil
      )
      # Non-terminal: NO automatic retry, NO compensating reversal
    else
      payout_leg.update!(
        state: 'unknown',
        external_id: external_id,
        failure_code: nil
      )
    end
  end

  def compensate_failed_leg!(payout_leg)
    user = payout_leg.withdrawal.user
    user.with_lock do
      reversal_ref = "payout_leg:#{payout_leg.id}:reversal"
      return if LedgerEntry.exists?(reference: reversal_ref)

      user.balance_cents += payout_leg.amount_cents
      user.save!

      LedgerEntry.create!(
        user: user,
        entry_type: 'withdrawal_reversal',
        amount_cents: payout_leg.amount_cents,
        reference: reversal_ref,
        created_at: Time.current
      )
    end
  end
end
