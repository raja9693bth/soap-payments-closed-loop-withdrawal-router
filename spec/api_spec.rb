# frozen_string_literal: true

require 'spec_helper'
require 'rack/test'
require_relative '../api/app'

RSpec.describe 'SoapPaymentsApi HTTP Endpoints', type: :request do
  include Rack::Test::Methods

  def app
    SoapPaymentsApi
  end

  before(:each) do
    MockPayoutProvider.reset!
  end

  describe 'GET /api/health' do
    it 'returns ok status and environment metadata' do
      get '/api/health'
      expect(last_response.status).to eq(200)

      json = JSON.parse(last_response.body)
      expect(json['status']).to eq('ok')
      expect(json['environment']).to eq('sandbox')
      expect(json['database']).to eq('connected')
    end
  end

  describe 'GET /api/dashboard' do
    it 'returns valid financial KPIs and trend metrics' do
      user = User.create!(email: 'aarav@soapdemo.com', balance_cents: 10_000)
      LedgerEntry.create!(user: user, entry_type: 'deposit', amount_cents: 10_000, reference: 'dep_1', created_at: Time.current)

      get '/api/dashboard'
      expect(last_response.status).to eq(200)

      json = JSON.parse(last_response.body)
      expect(json).to have_key('kpis')
      expect(json['kpis']['active_users_count']).to eq(1)
      expect(json['kpis']['ledger_balanced']).to be true
      expect(json['system_status']['router']).to eq('healthy')
    end
  end

  describe 'POST /api/withdrawals' do
    let!(:user) { User.create!(email: 'aarav@soapdemo.com', balance_cents: 10_000) }
    let!(:card_pm) { PaymentMethod.create!(user: user, asset_class: 'fiat_card', external_token: 'card_4242') }
    let!(:upi_pm) { PaymentMethod.create!(user: user, asset_class: 'fiat_card', external_token: 'upi_1234') }
    let!(:bank_pm) { PaymentMethod.create!(user: user, asset_class: 'fiat_ach', external_token: 'bank_9876') }

    let!(:dep1) do
      Deposit.create!(
        user: user,
        payment_method: card_pm,
        amount_cents: 3_000,
        unrefunded_principal_cents: 3_000,
        settled_at: 2.days.ago
      )
    end

    let!(:dep2) do
      Deposit.create!(
        user: user,
        payment_method: upi_pm,
        amount_cents: 2_000,
        unrefunded_principal_cents: 2_000,
        settled_at: 1.day.ago
      )
    end

    before do
      LedgerEntry.create!(user: user, entry_type: 'deposit', amount_cents: 3_000, reference: "dep:#{dep1.id}", created_at: 2.days.ago)
      LedgerEntry.create!(user: user, entry_type: 'deposit', amount_cents: 2_000, reference: "dep:#{dep2.id}", created_at: 1.day.ago)
      LedgerEntry.create!(user: user, entry_type: 'adjustment', amount_cents: 5_000, reference: 'init_balance', created_at: 3.days.ago)
    end

    it 'executes a FIFO closed-loop withdrawal with residual leg' do
      payload = {
        user_id: user.id,
        amount_cents: 8_000,
        default_payout_method_id: bank_pm.id,
        idempotency_key: 'idem_test_8000'
      }

      post '/api/withdrawals', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(201)

      json = JSON.parse(last_response.body)
      expect(json['status']).to eq('ok')
      expect(json['legs'].size).to eq(3)
      # Leg 1: 3000 to card
      expect(json['legs'][0]['amount_cents']).to eq(3_000)
      expect(json['legs'][0]['payment_method_id']).to eq(card_pm.id)
      # Leg 2: 2000 to UPI
      expect(json['legs'][1]['amount_cents']).to eq(2_000)
      expect(json['legs'][1]['payment_method_id']).to eq(upi_pm.id)
      # Leg 3: 3000 residual to default bank payout
      expect(json['legs'][2]['amount_cents']).to eq(3_000)
      expect(json['legs'][2]['payment_method_id']).to eq(bank_pm.id)

      # Check user balance deducted atomically
      user.reload
      expect(user.balance_cents).to eq(2_000)
    end

    it 'returns 409 conflict when idempotency key reused with different payload' do
      payload1 = {
        user_id: user.id,
        amount_cents: 1_000,
        default_payout_method_id: bank_pm.id,
        idempotency_key: 'idem_conflict_key'
      }
      post '/api/withdrawals', payload1.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(201)

      payload2 = {
        user_id: user.id,
        amount_cents: 2_000,
        default_payout_method_id: bank_pm.id,
        idempotency_key: 'idem_conflict_key'
      }
      post '/api/withdrawals', payload2.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(409)

      json = JSON.parse(last_response.body)
      expect(json['error']['code']).to eq('idempotency_conflict')
    end

    it 'returns 422 unprocessable entity on insufficient funds' do
      payload = {
        user_id: user.id,
        amount_cents: 50_000, # more than balance of 10_000
        default_payout_method_id: bank_pm.id,
        idempotency_key: 'idem_insufficient'
      }
      post '/api/withdrawals', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(422)

      json = JSON.parse(last_response.body)
      expect(json['error']['code']).to eq('insufficient_funds')
    end

    it 'supports simulated provider failure and compensating reversal' do
      payload = {
        user_id: user.id,
        amount_cents: 1_000,
        default_payout_method_id: bank_pm.id,
        idempotency_key: 'idem_failed_provider',
        mock_provider_outcome: 'failed'
      }

      post '/api/withdrawals', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(201)

      json = JSON.parse(last_response.body)
      expect(json['legs'][0]['state']).to eq('failed')

      # Balance should be compensated
      user.reload
      expect(user.balance_cents).to eq(10_000)
    end
  end

  describe 'GET /api/ledger' do
    it 'returns ledger audit trail and verification status' do
      user = User.create!(email: 'kavya@soapdemo.com', balance_cents: 5_000)
      LedgerEntry.create!(user: user, entry_type: 'deposit', amount_cents: 5_000, reference: 'dep_kavya', created_at: Time.current)

      get '/api/ledger'
      expect(last_response.status).to eq(200)

      json = JSON.parse(last_response.body)
      expect(json['reconciled']).to be true
      expect(json['entries'].first['entry_type']).to eq('deposit')
    end
  end

  describe 'POST /api/webhooks' do
    it 'ingests webhook events and updates payout leg safely' do
      user = User.create!(email: 'webhook_user@soapdemo.com', balance_cents: 5_000)
      pm = PaymentMethod.create!(user: user, asset_class: 'fiat_ach', external_token: 'bank_wh')
      w = Withdrawal.create!(user: user, amount_cents: 2_000, state: 'submitted', idempotency_key: 'idem_wh', request_fingerprint: 'fp_wh')
      leg = PayoutLeg.create!(withdrawal: w, payment_method: pm, amount_cents: 2_000, state: 'submitted', external_id: 'ext_wh_123')

      webhook_payload = {
        external_event_id: 'evt_test_wh_1',
        event_type: 'payout.settled',
        payload: {
          external_id: 'ext_wh_123',
          status: 'settled'
        }
      }

      post '/api/webhooks', webhook_payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(200)

      leg.reload
      expect(leg.state).to eq('settled')
    end

    it 'handles duplicate webhook deliveries as idempotent no-ops' do
      webhook_payload = {
        external_event_id: 'evt_test_dup_1',
        event_type: 'payout.settled',
        payload: { external_id: 'ext_nonexistent_dup', status: 'settled' }
      }

      post '/api/webhooks', webhook_payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(200)

      # Second delivery with same external_event_id
      post '/api/webhooks', webhook_payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(200)
    end
  end

  describe 'GET /api/withdrawals/:id/ledger and /webhooks' do
    it 'returns related ledger entries and webhooks for a withdrawal' do
      user = User.create!(email: 'subres_user@soapdemo.com', balance_cents: 5_000)
      pm = PaymentMethod.create!(user: user, asset_class: 'fiat_ach', external_token: 'bank_subres')
      w = Withdrawal.create!(user: user, amount_cents: 2_000, state: 'submitted', idempotency_key: 'idem_subres', request_fingerprint: 'fp_subres')
      leg = PayoutLeg.create!(withdrawal: w, payment_method: pm, amount_cents: 2_000, state: 'submitted', external_id: 'ext_subres_1')
      LedgerEntry.create!(user: user, entry_type: 'withdrawal_debit', amount_cents: -2_000, reference: "withdrawal:#{w.id}", created_at: Time.current)
      WebhookEvent.create!(external_event_id: 'evt_subres_1', event_type: 'payout.submitted', payload: { external_id: 'ext_subres_1' }.to_json, processed_at: Time.current)

      get "/api/withdrawals/#{w.id}/ledger"
      expect(last_response.status).to eq(200)
      json = JSON.parse(last_response.body)
      expect(json['withdrawal_id']).to eq(w.id)
      expect(json['ledger_entries'].size).to eq(1)

      get "/api/withdrawals/#{w.id}/webhooks"
      expect(last_response.status).to eq(200)
      json = JSON.parse(last_response.body)
      expect(json['withdrawal_id']).to eq(w.id)
      expect(json['webhook_events'].size).to eq(1)
    end
  end

  describe 'API Error Matrix' do
    let!(:user) { User.create!(email: 'matrix_user@soapdemo.com', balance_cents: 10_000) }
    let!(:other_user) { User.create!(email: 'other_user@soapdemo.com', balance_cents: 10_000) }
    let!(:user_pm) { PaymentMethod.create!(user: user, asset_class: 'fiat_ach', external_token: 'bank_matrix_1') }
    let!(:other_pm) { PaymentMethod.create!(user: other_user, asset_class: 'fiat_ach', external_token: 'bank_other_1') }

    it 'returns 404 for non-existent user' do
      payload = { user_id: 999_999, amount_cents: 1_000, default_payout_method_id: user_pm.id }
      post '/api/withdrawals', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(404)
    end

    it 'returns 400 for zero, negative, or non-integer amount' do
      [0, -500, 'invalid'].each do |bad_amount|
        payload = { user_id: user.id, amount_cents: bad_amount, default_payout_method_id: user_pm.id }
        post '/api/withdrawals', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
        expect(last_response.status).to eq(400)
      end
    end

    it 'returns 404 for non-existent default payout method' do
      payload = { user_id: user.id, amount_cents: 1_000, default_payout_method_id: 999_999 }
      post '/api/withdrawals', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(404)
    end

    it 'returns 403 when payout method belongs to a different user' do
      payload = { user_id: user.id, amount_cents: 1_000, default_payout_method_id: other_pm.id }
      post '/api/withdrawals', payload.to_json, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(403)
    end
  end

  describe 'Pagination & Search Capabilities' do
    let!(:user) { User.create!(email: 'searchable_user@soapdemo.com', balance_cents: 50_000) }
    let!(:pm) { PaymentMethod.create!(user: user, asset_class: 'fiat_ach', external_token: 'bank_search_1') }

    before do
      5.times do |i|
        w = Withdrawal.create!(
          user: user,
          amount_cents: 1_000 * (i + 1),
          state: 'settled',
          idempotency_key: "search_idem_#{i}",
          request_fingerprint: Digest::SHA256.hexdigest("search_#{i}")
        )
        PayoutLeg.create!(
          withdrawal: w,
          payment_method: pm,
          amount_cents: w.amount_cents,
          state: 'settled'
        )
      end
    end

    it 'paginates withdrawals with real metadata' do
      get '/api/withdrawals?page=1&page_size=2'
      expect(last_response.status).to eq(200)

      json = JSON.parse(last_response.body)
      expect(json['pagination']).to be_present
      expect(json['pagination']['page']).to eq(1)
      expect(json['pagination']['page_size']).to eq(2)
      expect(json['pagination']['total_count']).to be >= 5
      expect(json['returned_count']).to eq(2)
      expect(json['withdrawals'].size).to eq(2)
    end

    it 'performs server-side search by user email' do
      get '/api/withdrawals?q=searchable_user'
      expect(last_response.status).to eq(200)

      json = JSON.parse(last_response.body)
      expect(json['withdrawals']).to all(include('user_email' => 'searchable_user@soapdemo.com'))
    end

    it 'performs server-side search on users' do
      get '/api/users?q=searchable'
      expect(last_response.status).to eq(200)

      json = JSON.parse(last_response.body)
      expect(json['users'].size).to be >= 1
      expect(json['users'].first['email']).to eq('searchable_user@soapdemo.com')
    end
  end

  describe 'Webhook Security & Verification' do
    let(:secret) { 'whsec_sandbox_demo_key_untrusted' }
    let(:payload) { { event_id: 'evt_sec_1', event_type: 'payout.settled', data: { external_id: 'leg_sec_1', status: 'settled' } }.to_json }

    it 'rejects payload exceeding 64KB with 413 Payload Too Large' do
      huge_body = { data: 'x' * 70_000 }.to_json
      post '/api/webhooks', huge_body, { 'CONTENT_TYPE' => 'application/json' }
      expect(last_response.status).to eq(413)
      json = JSON.parse(last_response.body)
      expect(json['error']['code']).to eq('payload_too_large')
    end

    it 'rejects invalid HMAC signature with 401 Unauthorized when signature is provided' do
      timestamp = Time.current.to_i.to_s
      post '/api/webhooks', payload, {
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_WEBHOOK_SIGNATURE' => 'bad_signature_hex',
        'HTTP_X_WEBHOOK_TIMESTAMP' => timestamp
      }
      expect(last_response.status).to eq(401)
      json = JSON.parse(last_response.body)
      expect(json['error']['code']).to eq('invalid_webhook_signature')
    end

    it 'rejects expired timestamp (+/- 5 minutes) with 401 Unauthorized' do
      timestamp = (Time.current.to_i - 600).to_s
      signature = OpenSSL::HMAC.hexdigest('SHA256', secret, "#{timestamp}.#{payload}")
      post '/api/webhooks', payload, {
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_WEBHOOK_SIGNATURE' => signature,
        'HTTP_X_WEBHOOK_TIMESTAMP' => timestamp
      }
      expect(last_response.status).to eq(401)
      json = JSON.parse(last_response.body)
      expect(json['error']['code']).to eq('webhook_timestamp_expired')
    end

    it 'accepts verified HMAC signature with valid timestamp' do
      timestamp = Time.current.to_i.to_s
      signature = OpenSSL::HMAC.hexdigest('SHA256', secret, "#{timestamp}.#{payload}")
      post '/api/webhooks', payload, {
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_WEBHOOK_SIGNATURE' => signature,
        'HTTP_X_WEBHOOK_TIMESTAMP' => timestamp
      }
      expect(last_response.status).to eq(200)
      expect(last_response.headers['X-Webhook-Auth']).to eq('hmac-verified')
    end
  end

  describe 'Host Authorization Enforcement' do
    it 'blocks requests from unauthorized Host headers with 403 Forbidden' do
      get '/api/health', {}, { 'HTTP_HOST' => 'untrusted-malicious-domain.com' }
      expect(last_response.status).to eq(403)
    end
  end
end
