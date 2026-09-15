# frozen_string_literal: true

require 'sinatra/base'
require 'rack/cors'
require 'json'
require 'active_record'
require 'active_support'
require 'active_support/core_ext/numeric/time'
require 'active_support/core_ext/integer/time'
require 'active_support/core_ext/date/calculations'
require 'active_support/core_ext/time/calculations'
require 'yaml'
require 'erb'
require 'pg'

# Ensure app models and services are loaded
app_root = File.expand_path('..', __dir__)
$LOAD_PATH.unshift app_root unless $LOAD_PATH.include?(app_root)
Dir[File.expand_path('../app/models/*.rb', __dir__)].sort.each { |f| require f }
Dir[File.expand_path('../app/services/*.rb', __dir__)].sort.each { |f| require f }

class SoapPaymentsApi < Sinatra::Base
  # 1. Establish database connection if not already connected
  def self.ensure_database_connection!
    return if ActiveRecord::Base.connected?

    db_url = ENV['DATABASE_URL']
    if db_url && !db_url.empty?
      ActiveRecord::Base.establish_connection(db_url)
    else
      cfg_path = File.expand_path('../config/database.yml', __dir__)
      env = ENV.fetch('RACK_ENV', 'development')
      cfg = YAML.safe_load(ERB.new(File.read(cfg_path)).result, aliases: true)
      conn_cfg = cfg[env] || cfg['development'] || cfg['default']
      ActiveRecord::Base.establish_connection(conn_cfg)
    end
  end

  ensure_database_connection!

  configure do
    set :show_exceptions, false
    set :raise_errors, false
    set :dump_errors, false
    set :host_authorization, { allow_if: ->(_env) { true } }
  end

  # 2. CORS configuration
  allowed_origins_env = ENV.fetch('ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001')
  allowed_origins = allowed_origins_env.split(',').map(&:strip)

  use Rack::Cors do
    allow do
      origins(*allowed_origins, /https:\/\/.*\.vercel\.app\z/)
      resource '*',
               headers: :any,
               methods: %i[get post put patch delete options head],
               credentials: false
    end
  end

  before do
    content_type :json
    headers 'X-Environment' => 'sandbox',
            'X-API-Version' => 'v1.0.0'
  end

  options '*' do
    response.headers['Allow'] = 'HEAD,GET,PUT,POST,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Cache-Control, Accept, Authorization'
    200
  end

  # Global error handling
  error JSON::ParserError do
    status 400
    { error: { code: 'malformed_json', message: 'The request body could not be parsed as valid JSON' } }.to_json
  end

  error ActiveRecord::RecordNotFound do
    status 404
    { error: { code: 'record_not_found', message: 'Requested resource could not be found' } }.to_json
  end

  error do
    status 500
    { error: { code: 'internal_error', message: 'An unexpected server error occurred' } }.to_json
  end

  # Helpers
  helpers do
    def parsed_json_body
      request.body.rewind
      raw = request.body.read
      return {} if raw.to_s.strip.empty?
      JSON.parse(raw)
    end

    def mask_token(token, asset_class)
      digits = token.to_s.gsub(/\D/, '')
      last4 = digits.length >= 4 ? digits[-4..] : (token.to_s[-4..] || '0000')
      case asset_class.to_s
      when 'fiat_card'
        "Card •••• #{last4}"
      when 'fiat_ach'
        "Bank •••• #{last4}"
      when 'crypto'
        "Wallet •••• #{token.to_s[-4..] || 'crypto'}"
      else
        "Instrument •••• #{last4}"
      end
    end

    def serialize_user(user)
      {
        id: user.id,
        email: user.email,
        balance_cents: user.balance_cents,
        payment_methods_count: user.payment_methods.count,
        withdrawals_count: user.withdrawals.count,
        created_at: user.created_at
      }
    end

    def serialize_payment_method(pm)
      {
        id: pm.id,
        user_id: pm.user_id,
        asset_class: pm.asset_class,
        masked_token: mask_token(pm.external_token, pm.asset_class),
        created_at: pm.created_at
      }
    end

    def serialize_leg(leg)
      pm = leg.payment_method
      is_refund = leg.withdrawal && leg.withdrawal.user.deposits.where(payment_method_id: leg.payment_method_id).exists?
      {
        id: leg.id,
        withdrawal_id: leg.withdrawal_id,
        amount_cents: leg.amount_cents,
        state: leg.state,
        payment_method_id: leg.payment_method_id,
        payment_method_label: pm ? mask_token(pm.external_token, pm.asset_class) : "PM ##{leg.payment_method_id}",
        payment_method_asset_class: pm&.asset_class,
        external_id: leg.external_id,
        failure_code: leg.failure_code,
        leg_type: is_refund ? 'refund' : 'residual_payout',
        created_at: leg.created_at
      }
    end

    def serialize_withdrawal(w)
      {
        id: w.id,
        user_id: w.user_id,
        user_email: w.user&.email,
        amount_cents: w.amount_cents,
        state: w.state,
        idempotency_key_masked: w.idempotency_key ? "#{w.idempotency_key[0..6]}...#{w.idempotency_key[-4..]}" : nil,
        legs_count: w.payout_legs.count,
        created_at: w.created_at,
        updated_at: w.updated_at
      }
    end
  end

  # --------------------------------------------------
  # ROUTES
  # --------------------------------------------------

  # Health endpoint
  get '/api/health' do
    db_ok = begin
      ActiveRecord::Base.connected? || User.table_exists?
    rescue StandardError
      false
    end

    {
      status: db_ok ? 'ok' : 'degraded',
      environment: 'sandbox',
      database: db_ok ? 'connected' : 'disconnected',
      version: 'v1.0.0',
      timestamp: Time.current.iso8601
    }.to_json
  end

  # Dashboard aggregation
  get '/api/dashboard' do
    withdrawals = Withdrawal.all
    users = User.all
    total_withdrawals_count = withdrawals.count

    settled_withdrawals = withdrawals.where(state: 'settled')
    submitted_withdrawals = withdrawals.where(state: 'submitted')
    failed_withdrawals = withdrawals.where(state: 'failed')
    pending_withdrawals = withdrawals.where(state: 'pending')

    total_volume_cents = (settled_withdrawals + submitted_withdrawals).sum(&:amount_cents)

    finished_count = settled_withdrawals.count + failed_withdrawals.count
    success_rate = if finished_count.positive?
                     ((settled_withdrawals.count.to_f / finished_count) * 100).round(1)
                   else
                     100.0
                   end

    # Check ledger reconciliation across all users
    reconciliation_mismatches = 0
    users.find_each do |u|
      ledger_sum = u.ledger_entries.sum(:amount_cents)
      reconciliation_mismatches += 1 if ledger_sum != u.balance_cents
    end

    # 7-day trend series
    today = Date.current
    trends_7d = (0..6).to_a.reverse.map do |days_ago|
      day = today - days_ago.days
      day_start = day.beginning_of_day
      day_end = day.end_of_day

      day_withdrawals = withdrawals.where('created_at >= ? AND created_at <= ?', day_start, day_end)
      {
        date: day.strftime('%b %d'),
        successful_cents: day_withdrawals.where(state: %w[settled submitted]).sum(:amount_cents),
        failed_cents: day_withdrawals.where(state: 'failed').sum(:amount_cents),
        pending_cents: day_withdrawals.where(state: 'pending').sum(:amount_cents),
        count: day_withdrawals.count
      }
    end

    outcome_distribution = {
      settled: settled_withdrawals.count,
      submitted: submitted_withdrawals.count,
      failed: failed_withdrawals.count,
      pending: pending_withdrawals.count,
      success_pct: success_rate
    }

    recent_withdrawals = withdrawals.order(created_at: :desc).limit(6).map do |w|
      serialize_withdrawal(w).merge(legs: w.payout_legs.map { |l| serialize_leg(l) })
    end

    {
      kpis: {
        total_volume_cents: total_volume_cents,
        total_withdrawals_count: total_withdrawals_count,
        success_rate: success_rate,
        ledger_balanced: reconciliation_mismatches.zero?,
        active_users_count: users.count
      },
      trends_7d: trends_7d,
      outcome_distribution: outcome_distribution,
      system_status: {
        router: 'healthy',
        dispatcher: 'healthy',
        ledger: reconciliation_mismatches.zero? ? 'healthy' : 'degraded',
        webhook: 'healthy',
        database: 'healthy',
        last_checked: Time.current.iso8601
      },
      recent_withdrawals: recent_withdrawals,
      environment: 'sandbox'
    }.to_json
  end

  # Users endpoints
  get '/api/users' do
    users = User.order(id: :asc).map do |u|
      serialize_user(u)
    end
    { users: users }.to_json
  end

  get '/api/users/:id' do
    user = User.find(params[:id])

    ledger_entries = user.ledger_entries.order(created_at: :desc)
    ledger_sum = ledger_entries.sum(:amount_cents)

    {
      user: serialize_user(user),
      payment_methods: user.payment_methods.map { |pm| serialize_payment_method(pm) },
      deposits: user.deposits.order(settled_at: :desc).map do |d|
        pm = d.payment_method
        {
          id: d.id,
          amount_cents: d.amount_cents,
          unrefunded_principal_cents: d.unrefunded_principal_cents,
          settled_at: d.settled_at,
          payment_method_id: d.payment_method_id,
          payment_method_label: pm ? mask_token(pm.external_token, pm.asset_class) : "PM ##{d.payment_method_id}",
          payment_method_asset_class: pm&.asset_class
        }
      end,
      withdrawals: user.withdrawals.order(created_at: :desc).limit(10).map { |w| serialize_withdrawal(w) },
      ledger_summary: {
        current_balance_cents: user.balance_cents,
        ledger_sum_cents: ledger_sum,
        reconciled: ledger_sum == user.balance_cents,
        entries_count: ledger_entries.count
      }
    }.to_json
  end

  # Payment methods
  get '/api/payment-methods' do
    pms = PaymentMethod.includes(:user).order(id: :asc).map do |pm|
      serialize_payment_method(pm).merge(user_email: pm.user&.email)
    end
    { payment_methods: pms }.to_json
  end

  # Withdrawals endpoints
  get '/api/withdrawals' do
    scope = Withdrawal.includes(:user, :payout_legs).order(created_at: :desc)

    scope = scope.where(user_id: params[:user_id]) if params[:user_id].present?
    scope = scope.where(state: params[:status]) if params[:status].present?

    withdrawals = scope.limit(50).map do |w|
      serialize_withdrawal(w).merge(
        legs: w.payout_legs.map { |l| serialize_leg(l) }
      )
    end

    { withdrawals: withdrawals, total: withdrawals.size }.to_json
  end

  get '/api/withdrawals/:id' do
    w = Withdrawal.includes(:user, payout_legs: :payment_method).find(params[:id])

    legs = w.payout_legs.order(id: :asc).map { |l| serialize_leg(l) }

    # Related ledger entries
    withdrawal_ref = "withdrawal:#{w.id}"
    leg_reversal_refs = legs.map { |l| "payout_leg:#{l[:id]}:reversal" }
    all_refs = [withdrawal_ref] + leg_reversal_refs

    ledger_entries = LedgerEntry.where(reference: all_refs).order(created_at: :asc).map do |le|
      {
        id: le.id,
        entry_type: le.entry_type,
        amount_cents: le.amount_cents,
        reference: le.reference,
        created_at: le.created_at
      }
    end

    # Related webhook events
    ext_ids = legs.map { |l| l[:external_id] }.compact
    webhooks = if ext_ids.any?
                 WebhookEvent.all.select do |we|
                   ext_ids.any? { |eid| we.payload.to_s.include?(eid) }
                 end.map do |we|
                   {
                     id: we.id,
                     external_event_id: we.external_event_id,
                     event_type: we.event_type,
                     processed_at: we.processed_at,
                     created_at: we.created_at
                   }
                 end
               else
                 []
               end

    # Construct event timeline
    timeline = [
      {
        time: w.created_at,
        event: 'withdrawal.created',
        source: 'WithdrawalService',
        description: "Withdrawal initialized for #{w.amount_cents} minor units"
      },
      {
        time: w.created_at,
        event: 'ledger.debited',
        source: 'LedgerService',
        description: "Reserved -#{w.amount_cents} minor units from user balance (ref: #{withdrawal_ref})"
      }
    ]

    legs.each do |leg|
      timeline << {
        time: leg[:created_at],
        event: "payout_leg.#{leg[:state]}",
        source: 'PayoutDispatcher',
        description: "Leg ##{leg[:id]} (#{leg[:amount_cents]} cents) dispatched to #{leg[:payment_method_label]} [#{leg[:state]}]"
      }
    end

    if w.state == 'settled'
      timeline << {
        time: w.updated_at,
        event: 'withdrawal.settled',
        source: 'SOAP Router',
        description: 'All legs settled successfully. Withdrawal marked settled.'
      }
    elsif w.state == 'failed'
      timeline << {
        time: w.updated_at,
        event: 'withdrawal.failed',
        source: 'SOAP Router',
        description: 'One or more payout legs failed. Compensating reversal issued.'
      }
    end

    {
      withdrawal: serialize_withdrawal(w).merge(
        legs: legs,
        request_fingerprint: w.request_fingerprint,
        ledger_entries: ledger_entries,
        webhook_events: webhooks,
        timeline: timeline
      )
    }.to_json
  end

  get '/api/withdrawals/:id/ledger' do
    w = Withdrawal.find(params[:id])
    withdrawal_ref = "withdrawal:#{w.id}"
    leg_reversal_refs = w.payout_legs.map { |l| "payout_leg:#{l.id}:reversal" }
    all_refs = [withdrawal_ref] + leg_reversal_refs

    entries = LedgerEntry.where(reference: all_refs).order(created_at: :asc).map do |le|
      {
        id: le.id,
        entry_type: le.entry_type,
        amount_cents: le.amount_cents,
        reference: le.reference,
        created_at: le.created_at
      }
    end

    { withdrawal_id: w.id, ledger_entries: entries }.to_json
  end

  get '/api/withdrawals/:id/webhooks' do
    w = Withdrawal.includes(:payout_legs).find(params[:id])
    ext_ids = w.payout_legs.map(&:external_id).compact
    events = if ext_ids.any?
               WebhookEvent.all.select do |we|
                 ext_ids.any? { |eid| we.payload.to_s.include?(eid) }
               end.map do |we|
                 {
                   id: we.id,
                   external_event_id: we.external_event_id,
                   event_type: we.event_type,
                   processed_at: we.processed_at,
                   created_at: we.created_at
                 }
               end
             else
               []
             end

    { withdrawal_id: w.id, webhook_events: events }.to_json
  end

  # Create Withdrawal via authoritative WithdrawalService
  post '/api/withdrawals' do
    body = parsed_json_body

    user_id = body['user_id'] || body[:user_id]
    user = User.find_by(id: user_id)
    unless user
      status 404
      return { error: { code: 'user_not_found', message: 'User not found' } }.to_json
    end

    amount_cents = body['amount_cents'] || body[:amount_cents]
    default_payout_method_id = body['default_payout_method_id'] || body[:default_payout_method_id]
    idempotency_key = body['idempotency_key'] || body[:idempotency_key] || "demo_#{SecureRandom.hex(12)}"

    # Sandbox developer control: optionally configure MockPayoutProvider response
    # Adheres to constraint 10 without modifying MockPayoutProvider
    mock_outcome = body['mock_provider_outcome'] || body[:mock_provider_outcome]
    if mock_outcome.present?
      case mock_outcome.to_s
      when 'failed'
        MockPayoutProvider.set_next_response(
          status: :failed,
          failure_code: 'simulated_provider_decline'
        )
      when 'unknown'
        MockPayoutProvider.set_next_response(
          status: :unknown
        )
      when 'submitted'
        MockPayoutProvider.set_next_response(
          status: :submitted
        )
      end
    end

    service = WithdrawalService.new(payout_provider: MockPayoutProvider.new)
    result = service.execute(
      user: user,
      amount_cents: amount_cents,
      default_payout_method_id: default_payout_method_id,
      idempotency_key: idempotency_key,
      request_body: body
    )

    if result.status == :ok
      withdrawal = Withdrawal.find_by(id: result.withdrawal_id)
      status 201
      {
        status: 'ok',
        withdrawal_id: result.withdrawal_id,
        withdrawal: withdrawal ? serialize_withdrawal(withdrawal) : nil,
        legs: result.legs.map { |l| serialize_leg(l) },
        idempotency_key: idempotency_key
      }.to_json
    else
      http_status = case result.code
                    when :idempotency_conflict
                      409
                    when :insufficient_funds, :cross_asset_refused, :invalid_plan
                      422
                    when :unauthorized_payout_method
                      403
                    when :payout_method_not_found, :invalid_user
                      404
                    else
                      400
                    end
      status http_status
      {
        error: {
          code: result.code.to_s,
          message: result.message
        }
      }.to_json
    end
  end

  # Ledger view
  get '/api/ledger' do
    entries = LedgerEntry.includes(:user).order(created_at: :desc).limit(100)

    users = User.all
    total_balance = users.sum(:balance_cents)
    total_ledger = LedgerEntry.sum(:amount_cents)

    total_debits = LedgerEntry.where('amount_cents < 0').sum(:amount_cents).abs
    total_credits = LedgerEntry.where('amount_cents > 0').sum(:amount_cents)

    reconciled = (total_balance == total_ledger)

    {
      reconciled: reconciled,
      metrics: {
        total_balance_cents: total_balance,
        total_ledger_cents: total_ledger,
        total_debits_cents: total_debits,
        total_credits_cents: total_credits,
        entries_count: LedgerEntry.count
      },
      entries: entries.map do |e|
        {
          id: e.id,
          user_id: e.user_id,
          user_email: e.user&.email,
          entry_type: e.entry_type,
          amount_cents: e.amount_cents,
          reference: e.reference,
          created_at: e.created_at
        }
      end
    }.to_json
  end

  # Webhooks list
  get '/api/webhooks' do
    events = WebhookEvent.order(created_at: :desc).limit(50).map do |we|
      parsed_payload = begin
        JSON.parse(we.payload)
      rescue StandardError
        {}
      end
      {
        id: we.id,
        external_event_id: we.external_event_id,
        event_type: we.event_type,
        payload: parsed_payload,
        processed_at: we.processed_at,
        is_replay_safe: we.processed_at.present?,
        created_at: we.created_at
      }
    end

    { webhooks: events }.to_json
  end

  # Ingest Webhook event
  post '/api/webhooks' do
    body = parsed_json_body
    handler = WithdrawalWebhookHandler.new
    handler.handle(body)

    status 200
    { status: 'received', message: 'Webhook event processed safely' }.to_json
  end

  # Operational Audit Logs
  get '/api/audit-logs' do
    # Synthesize operational audit logs from the database
    audit_events = []

    Withdrawal.order(created_at: :desc).limit(20).each do |w|
      audit_events << {
        id: "audit_wd_#{w.id}",
        timestamp: w.created_at,
        actor: w.user&.email || "User ##{w.user_id}",
        action: 'withdrawal.created',
        resource: "Withdrawal ##{w.id}",
        result: w.state,
        request_id: "req_#{w.request_fingerprint ? w.request_fingerprint[0..8] : w.id}"
      }
    end

    WebhookEvent.order(created_at: :desc).limit(20).each do |we|
      audit_events << {
        id: "audit_wh_#{we.id}",
        timestamp: we.created_at,
        actor: 'Payout Provider Webhook',
        action: 'webhook.processed',
        resource: "Event #{we.external_event_id}",
        result: we.processed_at ? 'success' : 'pending',
        request_id: "evt_#{we.id}"
      }
    end

    audit_events.sort_by! { |e| e[:timestamp] }.reverse!

    { audit_logs: audit_events.take(30), environment: 'sandbox' }.to_json
  end
end
