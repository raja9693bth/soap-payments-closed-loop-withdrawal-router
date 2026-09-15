// Types for SOAP Payments Fintech Operations Platform

export interface User {
  id: number;
  email: string;
  balance_cents: number;
  payment_methods_count: number;
  withdrawals_count: number;
  created_at: string;
}

export interface PaymentMethod {
  id: number;
  user_id: number;
  user_email?: string;
  asset_class: 'fiat_card' | 'fiat_ach' | 'crypto';
  masked_token: string;
  created_at: string;
}

export interface Deposit {
  id: number;
  amount_cents: number;
  unrefunded_principal_cents: number;
  settled_at: string;
  payment_method_id: number;
  payment_method_label: string;
  payment_method_asset_class: string;
}

export interface PayoutLeg {
  id: number;
  withdrawal_id: number;
  amount_cents: number;
  state: 'pending' | 'submitted' | 'settled' | 'failed' | 'unknown';
  payment_method_id: number;
  payment_method_label: string;
  payment_method_asset_class: string;
  external_id?: string | null;
  failure_code?: string | null;
  leg_type: 'refund' | 'residual_payout';
  created_at: string;
}

export interface Withdrawal {
  id: number;
  user_id: number;
  user_email?: string;
  amount_cents: number;
  state: 'pending' | 'submitted' | 'settled' | 'failed' | 'unknown';
  idempotency_key_masked?: string;
  legs_count: number;
  legs?: PayoutLeg[];
  request_fingerprint?: string;
  ledger_entries?: LedgerEntry[];
  webhook_events?: WebhookEventRecord[];
  timeline?: TimelineEvent[];
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: number;
  user_id: number;
  user_email?: string;
  entry_type: 'deposit' | 'withdrawal_debit' | 'withdrawal_reversal' | 'adjustment';
  amount_cents: number;
  reference: string;
  created_at: string;
}

export interface WebhookEventRecord {
  id: number;
  external_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at?: string | null;
  is_replay_safe: boolean;
  created_at: string;
}

export interface TimelineEvent {
  time: string;
  event: string;
  source: string;
  description: string;
}

export interface DashboardMetrics {
  kpis: {
    total_volume_cents: number;
    total_withdrawals_count: number;
    success_rate: number;
    ledger_balanced: boolean;
    active_users_count: number;
  };
  trends_7d: Array<{
    date: string;
    successful_cents: number;
    failed_cents: number;
    pending_cents: number;
    count: number;
  }>;
  outcome_distribution: {
    settled: number;
    submitted: number;
    failed: number;
    pending: number;
    success_pct: number;
  };
  system_status: {
    router: string;
    dispatcher: string;
    ledger: string;
    webhook: string;
    database: string;
    last_checked: string;
  };
  recent_withdrawals: Withdrawal[];
  environment: string;
}

export interface LedgerViewResponse {
  reconciled: boolean;
  metrics: {
    total_balance_cents: number;
    total_ledger_cents: number;
    total_debits_cents: number;
    total_credits_cents: number;
    entries_count: number;
  };
  entries: LedgerEntry[];
}

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  result: string;
  request_id: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface CreateWithdrawalRequest {
  user_id: number;
  amount_cents: number;
  default_payout_method_id: number;
  idempotency_key: string;
  mock_provider_outcome?: 'submitted' | 'failed' | 'unknown';
}

export interface CreateWithdrawalResponse {
  status: string;
  withdrawal_id: number;
  withdrawal?: Withdrawal;
  legs: PayoutLeg[];
  idempotency_key: string;
}
