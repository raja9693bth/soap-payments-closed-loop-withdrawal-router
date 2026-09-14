# MockPayoutProvider — in-process stand-in for a real payout provider.
# DO NOT MODIFY THIS FILE. The grader instantiates this class, configures
# the next responses, and inspects `recorded_calls` after your code runs.
#
# Interface:
#   #dispatch(amount_cents:, payment_method_id:, idempotency_key:)
#     → { status:, external_id:, failure_code: }
#
# The grader uses MockPayoutProvider.set_next_response(...) to control what
# `dispatch` returns. When unconfigured, dispatch returns a generic success.
class MockPayoutProvider
  class << self
    def reset!
      @next_responses = []
      @recorded_calls = []
    end

    def set_next_response(status:, external_id: nil, failure_code: nil)
      @next_responses ||= []
      @next_responses << { status: status, external_id: external_id, failure_code: failure_code }
    end

    def recorded_calls
      @recorded_calls ||= []
    end

    def _consume_next
      @next_responses ||= []
      @next_responses.shift
    end

    def _record(call)
      @recorded_calls ||= []
      @recorded_calls << call
    end
  end

  def dispatch(amount_cents:, payment_method_id:, idempotency_key:)
    self.class._record(
      amount_cents: amount_cents,
      payment_method_id: payment_method_id,
      idempotency_key: idempotency_key,
    )
    nxt = self.class._consume_next
    if nxt
      {
        status: nxt[:status],
        external_id: nxt[:external_id] || "ext_#{SecureRandom.hex(8)}",
        failure_code: nxt[:failure_code],
      }
    else
      {
        status: :submitted,
        external_id: "ext_#{SecureRandom.hex(8)}",
        failure_code: nil,
      }
    end
  end
end

require 'securerandom'
