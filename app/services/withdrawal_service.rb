require 'digest'
require 'json'

# WithdrawalService — public entry point for processing a user withdrawal.
# Orchestrates validation, idempotency, row locking, closed-loop resolution,
# atomic ledger debits, and external payout dispatch.
class WithdrawalService
  Result = Struct.new(:status, :withdrawal_id, :legs, :code, :message, keyword_init: true)

  def initialize(payout_provider:)
    @payout_provider = payout_provider
  end

  def execute(user:, amount_cents:, default_payout_method_id:, idempotency_key:, request_body:)
    # 1. Basic input validation
    return Result.new(status: :error, code: :invalid_user, message: "User is required") unless user.is_a?(User)
    unless amount_cents.is_a?(Integer) && amount_cents > 0
      return Result.new(status: :error, code: :invalid_amount, message: "Amount must be a positive integer in cents")
    end
    if idempotency_key.to_s.strip.empty?
      return Result.new(status: :error, code: :invalid_idempotency_key, message: "Idempotency key is required")
    end

    # 2. Payout method ownership validation
    default_pm = PaymentMethod.find_by(id: default_payout_method_id)
    unless default_pm
      return Result.new(status: :error, code: :payout_method_not_found, message: "Default payout method not found")
    end
    if default_pm.user_id != user.id
      return Result.new(status: :error, code: :unauthorized_payout_method, message: "Payout method does not belong to user")
    end

    # 3. Canonical request fingerprint & Idempotency check
    fingerprint = Digest::SHA256.hexdigest(request_body.is_a?(String) ? request_body : request_body.to_json)

    existing_key = IdempotencyKey.find_by(key: idempotency_key)
    if existing_key
      if existing_key.request_fingerprint != fingerprint
        return Result.new(
          status: :error,
          code: :idempotency_conflict,
          message: "Idempotency key already used with different request parameters"
        )
      end

      # Return cached response
      cached = JSON.parse(existing_key.response_body, symbolize_names: true)
      cached_legs = if cached[:withdrawal_id]
        PayoutLeg.where(withdrawal_id: cached[:withdrawal_id]).to_a
      else
        cached[:legs]
      end

      return Result.new(
        status: cached[:status]&.to_sym,
        withdrawal_id: cached[:withdrawal_id],
        legs: cached_legs,
        code: cached[:code]&.to_sym,
        message: cached[:message]
      )
    end

    # 4. Atomic balance reservation & closed loop allocation
    withdrawal = nil
    legs = []
    error_result = nil

    is_concurrent_replay = false

    ActiveRecord::Base.transaction do
      # Pessimistic lock on balance owner
      locked_user = User.lock("FOR UPDATE").find(user.id)

      # Concurrency safeguard: check if this idempotency key was claimed while waiting for the user lock
      existing_w = Withdrawal.find_by(idempotency_key: idempotency_key)
      if existing_w
        if existing_w.request_fingerprint != fingerprint
          error_result = Result.new(
            status: :error,
            code: :idempotency_conflict,
            message: "Idempotency key already used with different request parameters"
          )
        else
          withdrawal = existing_w
          legs = existing_w.payout_legs.to_a
          is_concurrent_replay = true
        end
        raise ActiveRecord::Rollback
      end

      if locked_user.balance_cents < amount_cents
        error_result = Result.new(status: :error, code: :insufficient_funds, message: "Insufficient funds")
        raise ActiveRecord::Rollback
      end

      # Resolve closed-loop legs with candidate deposit locks
      begin
        resolver = ClosedLoopResolver.new
        plan = resolver.resolve(
          user: locked_user,
          amount_cents: amount_cents,
          default_payout_method_id: default_payout_method_id,
          lock: true
        )
      rescue ClosedLoopResolver::CrossAssetError => e
        error_result = Result.new(status: :error, code: :cross_asset_refused, message: e.message)
        raise ActiveRecord::Rollback
      rescue ClosedLoopResolver::PayoutOwnershipError => e
        error_result = Result.new(status: :error, code: :unauthorized_payout_method, message: e.message)
        raise ActiveRecord::Rollback
      rescue ClosedLoopResolver::Error => e
        error_result = Result.new(status: :error, code: :invalid_plan, message: e.message)
        raise ActiveRecord::Rollback
      end

      # Mutate user balance under lock
      locked_user.balance_cents -= amount_cents
      locked_user.save!

      # Persist withdrawal
      withdrawal = Withdrawal.create!(
        user: locked_user,
        amount_cents: amount_cents,
        state: 'pending',
        idempotency_key: idempotency_key,
        request_fingerprint: fingerprint
      )

      # Persist append-only ledger reservation entry
      LedgerEntry.create!(
        user: locked_user,
        entry_type: 'withdrawal_debit',
        amount_cents: -amount_cents,
        reference: "withdrawal:#{withdrawal.id}",
        created_at: Time.current
      )

      # Create legs and consume refundable principal
      plan.each do |entry|
        leg = PayoutLeg.create!(
          withdrawal: withdrawal,
          payment_method_id: entry.payment_method_id,
          amount_cents: entry.amount_cents,
          state: 'pending'
        )
        legs << leg

        if entry.source.is_a?(Deposit)
          entry.source.unrefunded_principal_cents -= entry.amount_cents
          entry.source.save!
        end
      end
    end

    return error_result if error_result

    # If the withdrawal was claimed by a concurrent thread with the same key and body,
    # return the identical result without duplicate dispatch
    if is_concurrent_replay
      return Result.new(
        status: :ok,
        withdrawal_id: withdrawal.id,
        legs: legs,
        code: nil,
        message: nil
      )
    end

    # 5. Dispatch legs outside of database transaction lock
    dispatcher = PayoutDispatcher.new(payout_provider: @payout_provider)
    legs.each do |leg|
      dispatcher.dispatch(leg)
      leg.reload
    end

    # Determine aggregated withdrawal state
    if legs.any? { |l| l.state == 'failed' }
      withdrawal.update!(state: 'failed')
    elsif legs.all? { |l| l.state == 'submitted' }
      withdrawal.update!(state: 'submitted')
    elsif legs.all? { |l| l.state == 'settled' }
      withdrawal.update!(state: 'settled')
    end

    result = Result.new(
      status: :ok,
      withdrawal_id: withdrawal.id,
      legs: legs,
      code: nil,
      message: nil
    )

    # 6. Record idempotency entry
    IdempotencyKey.create_or_find_by!(key: idempotency_key) do |k|
      k.request_fingerprint = fingerprint
      k.response_body = {
        status: result.status,
        withdrawal_id: result.withdrawal_id,
        legs: legs.map { |l| { id: l.id, amount_cents: l.amount_cents, state: l.state, payment_method_id: l.payment_method_id, external_id: l.external_id } },
        code: result.code,
        message: result.message
      }.to_json
      k.response_status = 200
    end

    result
  end
end
