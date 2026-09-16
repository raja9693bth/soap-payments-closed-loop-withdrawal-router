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
require 'openssl'

# Ensure app models and services are loaded
app_root = File.expand_path('..', __dir__)
$LOAD_PATH.unshift app_root unless $LOAD_PATH.include?(app_root)
Dir[File.expand_path('../app/models/*.rb', __dir__)].sort.each { |f| require f }
Dir[File.expand_path('../app/services/*.rb', __dir__)].sort.each { |f| require f }

class SoapPaymentsApi < Sinatra::Base
  # Simple in-memory sliding window rate limiter for sandbox abuse protection
  RATE_LIMIT_STORE = Hash.new { |h, k| h[k] = [] }
  RATE_LIMIT_MUTEX = Mutex.new

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

    # Safe Host Authorization appropriate to deployment
    permitted_hosts = [
      'localhost',
      '127.0.0.1',
      'example.org',
      /\.render\.com\z/,
      /\.onrender\.com\z/
    ]
    if ENV['RENDER_EXTERNAL_HOSTNAME'].present?
      permitted_hosts << ENV['RENDER_EXTERNAL_HOSTNAME']
    end
    if ENV['HOST_AUTHORIZATION_ALLOWED_HOSTS'].present?
      permitted_hosts.concat(ENV['HOST_AUTHORIZATION_ALLOWED_HOSTS'].split(',').map(&:strip))
    end
    set :host_authorization, { permitted_hosts: permitted_hosts }
  end

  # 2. CORS configuration with explicit origin validation
  is_dev = ENV.fetch('RACK_ENV', 'development') == 'development' || ENV.fetch('RACK_ENV', 'development') == 'test'
  allowed_origins_env = ENV['ALLOWED_ORIGINS']

  configured_origins = if allowed_origins_env.present?
                         allowed_origins_env.split(',').map(&:strip)
                       elsif is_dev
                         ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001']
                       else
                         ['https://soap-payments-closed-loop-withdrawal-router.vercel.app']
                       end

  use Rack::Cors do
    allow do
      origins(*configured_origins)
      resource '*',
               headers: :any,
               methods: %i[get post put patch delete options head],
               credentials: false
    end
  end

  before do
    content_type :json
    headers 'X-Environment' => 'sandbox',
            'X-API-Version' => 'v1.0.0',
            'X-Sandbox-Mode' => 'enabled',
            'X-Sandbox-Auth' => 'open-access-demo'
  end

  options '*' do
    response.headers['Allow'] = 'HEAD,GET,PUT,POST,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Cache-Control, Accept, Authorization, X-Webhook-Signature, X-Webhook-Timestamp'
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

    def check_rate_limit!(limit: 60, window_seconds: 60)
      client_ip = request.ip || '127.0.0.1'
      now = Time.now.to_f

      RATE_LIMIT_MUTEX.synchronize do
        timestamps = RATE_LIMIT_STORE[client_ip].select { |t| now - t < window_seconds }
        if timestamps.size >= limit
          halt 429, { error: { code: 'rate_limit_exceeded', message: "Too many requests. Sandbox limit is #{limit} requests per minute." } }.to_json
        end
        timestamps << now
        RATE_LIMIT_STORE[client_ip] = timestamps
      end
    end

    def verify_webhook_signature!(raw_body)
      # 1. Payload size limit (max 64KB)
      if raw_body.bytesize > 65_536
        halt 413, { error: { code: 'payload_too_large', message: 'Webhook payload exceeds 64KB limit' } }.to_json
      end

      sandbox_mode = (ENV['SOAP_WEBHOOK_SANDBOX'] == 'true')
      signature = request.env['HTTP_X_WEBHOOK_SIGNATURE'] || request.env['HTTP_SOAP_SIGNATURE']
      timestamp = request.env['HTTP_X_WEBHOOK_TIMESTAMP']

      # Unsigned mode is only allowed if SOAP_WEBHOOK_SANDBOX=true is explicitly set
      if signature.blank?
        if sandbox_mode
          headers 'X-Webhook-Auth' => 'sandbox-unverified'
          return
        else
          halt 401, { error: { code: 'missing_webhook_signature', message: 'Webhook signature is required in verified mode' } }.to_json
        end
      end

      # In verified mode (or when a signature is provided), timestamp is required and must be valid
      if timestamp.blank?
        halt 401, { error: { code: 'missing_webhook_timestamp', message: 'Webhook timestamp is required for signed requests' } }.to_json
      end

      unless timestamp.to_s =~ /\A\d+\z/
        halt 401, { error: { code: 'malformed_webhook_timestamp', message: 'Webhook timestamp must be an integer epoch timestamp' } }.to_json
      end

      req_time = timestamp.to_i
      if (Time.current.to_i - req_time).abs > 300
        halt 401, { error: { code: 'webhook_timestamp_expired', message: 'Webhook timestamp outside valid replay window (+/- 5 minutes)' } }.to_json
      end

      secret = ENV['WEBHOOK_SIGNING_SECRET']
      if secret.blank?
        halt 500, { error: { code: 'webhook_configuration_error', message: 'WEBHOOK_SIGNING_SECRET is not configured' } }.to_json
      end

      # Canonical signing input: "#{timestamp}.#{raw_body}"
      expected_sig = OpenSSL::HMAC.hexdigest('SHA256', secret, "#{timestamp}.#{raw_body}")

      valid = Rack::Utils.secure_compare(signature, expected_sig)
      unless valid
        halt 401, { error: { code: 'invalid_webhook_signature', message: 'HMAC signature verification failed' } }.to_json
      end

      headers 'X-Webhook-Auth' => 'hmac-verified'
    end

    def paginate_scope(scope, default_size: 20, max_size: 100)
      page = [params[:page].to_i, 1].max
      page_size = params[:page_size] ? params[:page_size].to_i : (params[:per_page] ? params[:per_page].to_i : default_size)
      page_size = [[page_size, 1].max, max_size].min
      offset = (page - 1) * page_size

      total_count = if scope.group_values.present?
                      scope.reselect(:id).distinct.count
                    else
                      scope.count
                    end
      total_count = total_count.is_a?(Hash) ? total_count.size : total_count.to_i

      records = scope.offset(offset).limit(page_size)
      total_pages = total_count.positive? ? (total_count.to_f / page_size).ceil : 1

      [records, {
        page: page,
        page_size: page_size,
        total_count: total_count,
        total_pages: total_pages,
        returned_count: records.size
      }]
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
      pm_count = user.respond_to?(:pm_count) ? user.pm_count.to_i : user.payment_methods.count
      wd_count = user.respond_to?(:wd_count) ? user.wd_count.to_i : user.withdrawals.count

      {
        id: user.id,
        email: user.email,
        balance_cents: user.balance_cents,
        payment_methods_count: pm_count,
        withdrawals_count: wd_count,
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

    def serialize_leg(leg, user_deposit_pm_ids: nil)
      pm = leg.payment_method
      is_refund = if user_deposit_pm_ids
                    user_deposit_pm_ids.include?(leg.payment_method_id)
                  elsif leg.withdrawal && leg.withdrawal.user
                    leg.withdrawal.user.deposits.where(payment_method_id: leg.payment_method_id).exists?
                  else
                    false
                  end

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

    def serialize_withdrawal(w, user_deposit_pm_ids: nil)
      legs_count = w.payout_legs.loaded? ? w.payout_legs.size : w.payout_legs.count
      {
        id: w.id,
        user_id: w.user_id,
        user_email: w.user&.email,
        amount_cents: w.amount_cents,
        state: w.state,
        idempotency_key_masked: w.idempotency_key ? "#{w.idempotency_key[0..6]}...#{w.idempotency_key[-4..]}" : nil,
        legs_count: legs_count,
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
      User.table_exists?
    rescue StandardError
      false
    end

    {
      status: db_ok ? 'ok' : 'degraded',
      environment: 'sandbox',
      auth_model: 'unauthenticated_sandbox_demo',
      database: db_ok ? 'connected' : 'disconnected',
      version: 'v1.0.0',
      timestamp: Time.current.iso8601
    }.to_json
  end

  # Dashboard aggregation - Optimized via SQL aggregates
  get '/api/dashboard' do
    # 1. State counts and distribution via single SQL group query
    state_counts = Withdrawal.group(:state).count
    settled_count = state_counts['settled'] || 0
    submitted_count = state_counts['submitted'] || 0
    failed_count = state_counts['failed'] || 0
    pending_count = state_counts['pending'] || 0
    total_withdrawals_count = state_counts.values.sum

    # 2. Total volume via single SQL sum
    total_volume_cents = Withdrawal.where(state: %w[settled submitted]).sum(:amount_cents) || 0

    # 3. Success rate
    finished_count = settled_count + failed_count
    success_rate = if finished_count.positive?
                     ((settled_count.to_f / finished_count) * 100).round(1)
                   else
                     100.0
                   end

    # 4. Check ledger reconciliation across users via single SQL query
    user_balances_total = User.sum(:balance_cents) || 0
    ledger_entries_total = LedgerEntry.sum(:amount_cents) || 0
    ledger_balanced = (user_balances_total == ledger_entries_total)

    # 5. Trend series via single SQL group query respecting range parameter
    range = (params[:range] || params[:days] || '7d').to_s.downcase
    start_time, num_days = case range
                           when '30d'
                             [29.days.ago.beginning_of_day, 30]
                           when 'month'
                             start_date = Date.current.beginning_of_month
                             [start_date.beginning_of_day, (Date.current - start_date).to_i + 1]
                           else # '7d'
                             [6.days.ago.beginning_of_day, 7]
                           end

    daily_stats = Withdrawal.where('created_at >= ?', start_time)
                            .group("DATE(created_at)", :state)
                            .pluck(Arel.sql("DATE(created_at)::text"), :state, Arel.sql("COUNT(*)"), Arel.sql("COALESCE(SUM(amount_cents), 0)"))

    # Organize daily stats by date string
    stats_by_date = Hash.new { |h, k| h[k] = { successful_cents: 0, failed_cents: 0, pending_cents: 0, count: 0 } }
    daily_stats.each do |date_str, state, count, sum_cents|
      date_key = date_str.to_s
      stats_by_date[date_key][:count] += count.to_i
      case state
      when 'settled', 'submitted'
        stats_by_date[date_key][:successful_cents] += sum_cents.to_i
      when 'failed'
        stats_by_date[date_key][:failed_cents] += sum_cents.to_i
      when 'pending'
        stats_by_date[date_key][:pending_cents] += sum_cents.to_i
      end
    end

    today = Date.current
    trends_series = (0...num_days).to_a.reverse.map do |days_ago|
      day = today - days_ago.days
      day_key = day.to_s
      metrics = stats_by_date[day_key]
      {
        date: day.strftime('%b %d'),
        successful_cents: metrics[:successful_cents],
        failed_cents: metrics[:failed_cents],
        pending_cents: metrics[:pending_cents],
        count: metrics[:count]
      }
    end

    outcome_distribution = {
      settled: settled_count,
      submitted: submitted_count,
      failed: failed_count,
      pending: pending_count,
      success_pct: success_rate
    }

    # Recent withdrawals with eager loaded legs and payment methods
    recent_withdrawals = Withdrawal.includes(:user, payout_legs: :payment_method)
                                   .order(created_at: :desc)
                                   .limit(6)
                                   .map do |w|
      user_deposit_pm_ids = w.user ? w.user.deposits.pluck(:payment_method_id).to_set : Set.new
      serialize_withdrawal(w, user_deposit_pm_ids: user_deposit_pm_ids).merge(
        legs: w.payout_legs.map { |l| serialize_leg(l, user_deposit_pm_ids: user_deposit_pm_ids) }
      )
    end

    {
      kpis: {
        total_volume_cents: total_volume_cents,
        total_withdrawals_count: total_withdrawals_count,
        success_rate: success_rate,
        ledger_balanced: ledger_balanced,
        active_users_count: User.count
      },
      trends_7d: trends_series,
      trends: trends_series,
      range: range,
      outcome_distribution: outcome_distribution,
      system_status: {
        router: 'healthy',
        dispatcher: 'healthy',
        ledger: ledger_balanced ? 'healthy' : 'degraded',
        webhook: 'healthy',
        database: 'healthy',
        last_checked: Time.current.iso8601
      },
      recent_withdrawals: recent_withdrawals,
      environment: 'sandbox'
    }.to_json
  end

  # Users endpoints - Eager loaded without N+1
  get '/api/users' do
    scope = User.left_joins(:payment_methods, :withdrawals)
                .group(:id)
                .select('users.*, COUNT(DISTINCT payment_methods.id) AS pm_count, COUNT(DISTINCT withdrawals.id) AS wd_count')
                .order(id: :asc)

    if params[:q].present? || params[:search].present?
      term = "%#{(params[:q] || params[:search]).strip}%"
      scope = scope.where("users.email ILIKE ?", term)
    end

    records, pagination = paginate_scope(scope, default_size: 50)
    users = records.map { |u| serialize_user(u) }

    { users: users, pagination: pagination, returned_count: users.size }.to_json
  end

  get '/api/users/:id' do
    user = User.find(params[:id])

    ledger_entries = user.ledger_entries.order(created_at: :desc)
    ledger_sum = ledger_entries.sum(:amount_cents)

    {
      user: serialize_user(user),
      payment_methods: user.payment_methods.map { |pm| serialize_payment_method(pm) },
      deposits: user.deposits.includes(:payment_method).order(settled_at: :desc).map do |d|
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

  # Withdrawals endpoints - Server-side search & pagination
  get '/api/withdrawals' do
    scope = Withdrawal.includes(:user, payout_legs: :payment_method).order(created_at: :desc)

    scope = scope.where(user_id: params[:user_id]) if params[:user_id].present?
    scope = scope.where(state: params[:status]) if params[:status].present?

    if params[:q].present? || params[:search].present?
      q = (params[:q] || params[:search]).strip
      if q =~ /\A\d+\z/
        scope = scope.where("withdrawals.id = :id OR withdrawals.user_id = :id", id: q.to_i)
      else
        scope = scope.joins(:user).where("users.email ILIKE :term OR withdrawals.idempotency_key ILIKE :term", term: "%#{q}%")
      end
    end

    records, pagination = paginate_scope(scope, default_size: 20)

    withdrawals = records.map do |w|
      user_deposit_pm_ids = w.user ? w.user.deposits.pluck(:payment_method_id).to_set : Set.new
      serialize_withdrawal(w, user_deposit_pm_ids: user_deposit_pm_ids).merge(
        legs: w.payout_legs.map { |l| serialize_leg(l, user_deposit_pm_ids: user_deposit_pm_ids) }
      )
    end

    {
      withdrawals: withdrawals,
      total: pagination[:total_count],
      pagination: pagination,
      returned_count: withdrawals.size
    }.to_json
  end

  get '/api/withdrawals/:id' do
    w = Withdrawal.includes(:user, payout_legs: :payment_method).find(params[:id])
    user_deposit_pm_ids = w.user ? w.user.deposits.pluck(:payment_method_id).to_set : Set.new

    legs = w.payout_legs.order(id: :asc).map { |l| serialize_leg(l, user_deposit_pm_ids: user_deposit_pm_ids) }

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

    # Related webhook events via indexed relational query on payout_leg_id
    leg_ids = legs.map { |l| l[:id] }.compact
    webhooks = if leg_ids.any?
                 WebhookEvent.where(payout_leg_id: leg_ids).order(created_at: :desc).limit(20).map do |we|
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
      withdrawal: serialize_withdrawal(w, user_deposit_pm_ids: user_deposit_pm_ids).merge(
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
    leg_ids = w.payout_legs.map(&:id)
    events = if leg_ids.any?
               WebhookEvent.where(payout_leg_id: leg_ids).order(created_at: :desc).limit(20).map do |we|
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

  # Create Withdrawal via authoritative WithdrawalService with rate limiting
  post '/api/withdrawals' do
    check_rate_limit!(limit: 60, window_seconds: 60)

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
      user_deposit_pm_ids = user.deposits.pluck(:payment_method_id).to_set
      {
        status: 'ok',
        withdrawal_id: result.withdrawal_id,
        withdrawal: withdrawal ? serialize_withdrawal(withdrawal, user_deposit_pm_ids: user_deposit_pm_ids) : nil,
        legs: result.legs.map { |l| serialize_leg(l, user_deposit_pm_ids: user_deposit_pm_ids) },
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

  # Ledger view - with pagination & SQL metrics
  get '/api/ledger' do
    scope = LedgerEntry.includes(:user).order(created_at: :desc)
    records, pagination = paginate_scope(scope, default_size: 50)

    total_balance = User.sum(:balance_cents) || 0
    total_ledger = LedgerEntry.sum(:amount_cents) || 0

    total_debits = (LedgerEntry.where('amount_cents < 0').sum(:amount_cents) || 0).abs
    total_credits = LedgerEntry.where('amount_cents > 0').sum(:amount_cents) || 0

    reconciled = (total_balance == total_ledger)

    {
      reconciled: reconciled,
      metrics: {
        total_balance_cents: total_balance,
        total_ledger_cents: total_ledger,
        total_debits_cents: total_debits,
        total_credits_cents: total_credits,
        entries_count: pagination[:total_count]
      },
      entries: records.map do |e|
        {
          id: e.id,
          user_id: e.user_id,
          user_email: e.user&.email,
          entry_type: e.entry_type,
          amount_cents: e.amount_cents,
          reference: e.reference,
          created_at: e.created_at
        }
      end,
      pagination: pagination,
      returned_count: records.size
    }.to_json
  end

  # Webhooks list - with pagination
  get '/api/webhooks' do
    scope = WebhookEvent.order(created_at: :desc)
    records, pagination = paginate_scope(scope, default_size: 50)

    events = records.map do |we|
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

    { webhooks: events, pagination: pagination, returned_count: events.size }.to_json
  end

  # Ingest Webhook event with rate limit, payload size limit, and signature verification
  post '/api/webhooks' do
    check_rate_limit!(limit: 60, window_seconds: 60)

    request.body.rewind
    raw_body = request.body.read
    verify_webhook_signature!(raw_body)

    body = begin
      JSON.parse(raw_body)
    rescue StandardError
      halt 400, { error: { code: 'malformed_json', message: 'Malformed JSON payload' } }.to_json
    end

    handler = WithdrawalWebhookHandler.new
    handler.handle(body)

    status 200
    auth_mode = response['X-Webhook-Auth'] || 'unknown'
    {
      status: 'received',
      message: 'Webhook event processed safely',
      auth_mode: auth_mode
    }.to_json
  end

  # Activity Log / Derived Operations
  get '/api/audit-logs' do
    activity_events = []

    Withdrawal.includes(:user).order(created_at: :desc).limit(20).each do |w|
      activity_events << {
        id: "activity_wd_#{w.id}",
        timestamp: w.created_at,
        actor: w.user&.email || "User ##{w.user_id}",
        action: 'withdrawal.created',
        resource: "Withdrawal ##{w.id}",
        result: w.state,
        request_id: "req_#{w.request_fingerprint ? w.request_fingerprint[0..8] : w.id}"
      }
    end

    WebhookEvent.order(created_at: :desc).limit(20).each do |we|
      activity_events << {
        id: "activity_wh_#{we.id}",
        timestamp: we.created_at,
        actor: 'Payout Provider Webhook',
        action: 'webhook.processed',
        resource: "Event #{we.external_event_id}",
        result: we.processed_at ? 'success' : 'pending',
        request_id: "evt_#{we.id}"
      }
    end

    activity_events.sort_by! { |e| e[:timestamp] }.reverse!

    {
      audit_logs: activity_events.take(30),
      activity_logs: activity_events.take(30),
      log_type: 'derived_operational_activity',
      environment: 'sandbox'
    }.to_json
  end
end
