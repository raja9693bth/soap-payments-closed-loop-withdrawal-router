# WithdrawalWebhookHandler — handles async settlement / failure callbacks
# from the payout provider. Called once per inbound webhook event.
class WithdrawalWebhookHandler
  def handle(event)
    external_event_id, event_type, payload = extract_event_metadata(event)

    webhook_record = nil
    if external_event_id.present?
      webhook_record = WebhookEvent.find_by(external_event_id: external_event_id)
      # Duplicate webhook event is a no-op
      return if webhook_record&.processed_at.present?

      webhook_record ||= WebhookEvent.create_or_find_by!(external_event_id: external_event_id) do |w|
        w.event_type = event_type.to_s
        w.payload = payload.is_a?(String) ? payload : payload.to_json
      end
    end

    leg = find_payout_leg(event, payload)
    return unless leg

    incoming_status = extract_incoming_status(event, payload, event_type)
    failure_code = extract_failure_code(event, payload)

    apply_transition!(leg, incoming_status, failure_code)

    webhook_record&.update!(processed_at: Time.current, payout_leg_id: leg.id)
  end

  private

  def extract_event_metadata(event)
    if event.is_a?(WebhookEvent)
      [event.external_event_id, event.event_type, event.payload]
    elsif event.is_a?(Hash)
      id = event[:external_event_id] || event['external_event_id'] || event[:event_id] || event['event_id']
      type = event[:event_type] || event['event_type'] || event[:type] || event['type']
      payload = event[:payload] || event['payload'] || event
      [id, type, payload]
    else
      [nil, nil, event]
    end
  end

  def find_payout_leg(event, payload)
    parsed_payload = if payload.is_a?(String)
      begin
        JSON.parse(payload)
      rescue JSON::ParserError
        {}
      end
    elsif payload.is_a?(Hash)
      payload
    else
      {}
    end

    ext_id = parsed_payload['external_id'] || parsed_payload[:external_id]
    ext_id ||= event[:external_id] || event['external_id'] if event.is_a?(Hash)

    leg = PayoutLeg.find_by(external_id: ext_id) if ext_id.present?
    if leg.nil? && event.is_a?(Hash)
      leg_id = event[:payout_leg_id] || event['payout_leg_id'] || parsed_payload['payout_leg_id'] || parsed_payload[:payout_leg_id]
      leg = PayoutLeg.find_by(id: leg_id) if leg_id.present?
    end

    leg
  end

  def extract_incoming_status(event, payload, event_type)
    status_candidate = nil
    if payload.is_a?(Hash)
      status_candidate = payload[:status] || payload['status']
    elsif payload.is_a?(String)
      begin
        parsed = JSON.parse(payload)
        status_candidate = parsed['status'] || parsed[:status]
      rescue JSON::ParserError
        nil
      end
    end

    status_candidate ||= event[:status] || event['status'] if event.is_a?(Hash)
    status_candidate ||= event_type

    case status_candidate.to_s.downcase
    when 'settled', 'succeeded', 'payout.settled', 'payout.succeeded'
      'settled'
    when 'failed', 'payout.failed'
      'failed'
    when 'submitted', 'payout.submitted'
      'submitted'
    when 'unknown', 'payout.unknown'
      'unknown'
    else
      'unknown'
    end
  end

  def extract_failure_code(event, payload)
    if payload.is_a?(Hash)
      payload[:failure_code] || payload['failure_code']
    elsif payload.is_a?(String)
      begin
        parsed = JSON.parse(payload)
        parsed['failure_code'] || parsed[:failure_code]
      rescue JSON::ParserError
        nil
      end
    elsif event.is_a?(Hash)
      event[:failure_code] || event['failure_code']
    end
  end

  def apply_transition!(leg, incoming, failure_code)
    current = leg.state

    # Duplicate state is a no-op
    return if current == incoming

    # Late failure after settled: do not reverse, ignore safely
    if current == 'settled' && incoming == 'failed'
      return
    end

    # Disallow invalid transitions from terminal states
    return if current == 'settled' || current == 'failed'

    case incoming
    when 'settled'
      leg.update!(state: 'settled')
      update_withdrawal_if_all_settled(leg.withdrawal)
    when 'failed'
      leg.update!(state: 'failed', failure_code: failure_code)
      reverse_failed_leg!(leg)
      leg.withdrawal.update!(state: 'failed')
    when 'unknown'
      leg.update!(state: 'unknown')
      # Non-terminal: no reversal
    when 'submitted'
      leg.update!(state: 'submitted')
    end
  end

  def reverse_failed_leg!(leg)
    user = leg.withdrawal.user
    user.with_lock do
      reversal_ref = "payout_leg:#{leg.id}:reversal"
      return if LedgerEntry.exists?(reference: reversal_ref)

      user.balance_cents += leg.amount_cents
      user.save!

      LedgerEntry.create!(
        user: user,
        entry_type: 'withdrawal_reversal',
        amount_cents: leg.amount_cents,
        reference: reversal_ref,
        created_at: Time.current
      )
    end
  end

  def update_withdrawal_if_all_settled(withdrawal)
    return unless withdrawal
    if withdrawal.payout_legs.all? { |l| l.state == 'settled' }
      withdrawal.update!(state: 'settled')
    end
  end
end
