// Centralized API Client for SOAP Payments Operations Dashboard
import {
  DashboardMetrics,
  User,
  PaymentMethod,
  Deposit,
  Withdrawal,
  LedgerViewResponse,
  WebhookEventRecord,
  AuditLogEvent,
  CreateWithdrawalRequest,
  CreateWithdrawalResponse,
} from '@/types';

export interface ApiErrorDetail {
  code: string;
  message: string;
  status: number;
  resolution?: string;
}

export class SoapApiError extends Error {
  code: string;
  status: number;
  resolution?: string;

  constructor(detail: ApiErrorDetail) {
    super(detail.message);
    this.name = 'SoapApiError';
    this.code = detail.code;
    this.status = detail.status;
    this.resolution = detail.resolution;
  }
}

function resolveApiBaseUrl(): string {
  // 1. Explicit environment variable takes highest precedence
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }

  // 2. Client-side browser inspection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    if (isLocal) {
      return 'http://127.0.0.1:4567';
    }

    // In production browser without NEXT_PUBLIC_API_BASE_URL:
    // Do NOT call localhost or 127.0.0.1 in production.
    return '';
  }

  // 3. Server-side / build-time fallback
  if (process.env.NODE_ENV !== 'production') {
    return 'http://127.0.0.1:4567';
  }

  return '';
}

const API_BASE_URL = resolveApiBaseUrl();

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private mapDomainError(code: string, rawMessage: string, status: number): ApiErrorDetail {
    switch (code) {
      case 'idempotency_conflict':
        return {
          code,
          status,
          message: 'Idempotency Conflict: This idempotency key was previously submitted with different request parameters.',
          resolution: 'Generate a new idempotency key or submit the exact original request payload.',
        };
      case 'insufficient_funds':
        return {
          code,
          status,
          message: 'Insufficient Funds: User available balance is lower than the requested withdrawal amount.',
          resolution: 'Select an amount within the verified account balance.',
        };
      case 'cross_asset_refused':
        return {
          code,
          status,
          message: 'Cross-Asset Routing Refused: Residual payout cannot cross asset family boundaries.',
          resolution: 'Use a payout instrument matching the deposit asset family or withdraw within refundable deposit principal.',
        };
      case 'unauthorized_payout_method':
        return {
          code,
          status,
          message: 'Unauthorized Payout Method: The chosen default payout method does not belong to this account owner.',
          resolution: 'Select a verified payout instrument registered to this user.',
        };
      case 'payout_method_not_found':
        return {
          code,
          status,
          message: 'Payment Method Not Found: The selected payout instrument does not exist.',
          resolution: 'Choose an active verified payment instrument from the list.',
        };
      case 'user_not_found':
      case 'invalid_user':
        return {
          code,
          status,
          message: 'User Not Found: The specified account does not exist in the database.',
          resolution: 'Select a valid customer account from the dropdown.',
        };
      default:
        return {
          code: code || 'api_error',
          status,
          message: rawMessage || `HTTP ${status} server error`,
        };
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    // Guard against unconfigured API base in production
    if (isProduction && !this.baseUrl) {
      throw new SoapApiError({
        code: 'backend_unconfigured',
        status: 503,
        message: 'SOAP Payments API backend is not configured.',
        resolution: 'Set the NEXT_PUBLIC_API_BASE_URL environment variable in your Vercel project settings to your deployed Ruby API URL (e.g. on Render).',
      });
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = this.baseUrl ? `${this.baseUrl}${cleanEndpoint}` : cleanEndpoint;

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        const errorObj = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: { code?: string; message?: string } }).error : null;
        const code = errorObj?.code || `http_${response.status}`;
        const message = errorObj?.message || (typeof data === 'string' ? data : `HTTP ${response.status} error`);
        throw new SoapApiError(this.mapDomainError(code, message, response.status));
      }

      return data as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof SoapApiError) {
        throw err;
      }

      if ((err as Error).name === 'AbortError') {
        throw new SoapApiError({
          code: 'request_timeout',
          status: 504,
          message: 'The request to the SOAP Payments backend timed out after 12 seconds.',
          resolution: 'Check backend service health or retry the request.',
        });
      }

      const isProd = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      const targetHint = this.baseUrl || 'the API server';

      throw new SoapApiError({
        code: 'connection_refused',
        status: 503,
        message: isProd
          ? `Unable to connect to SOAP Payments backend at ${targetHint}. The service may be waking up or offline.`
          : 'Unable to connect to SOAP Payments backend API. Please ensure the local Ruby API server is running on port 4567.',
        resolution: isProd
          ? 'Verify your Render API service is deployed and active, then click Retry.'
          : 'Run: bundle exec puma -p 4567 config.ru',
      });
    }
  }

  async getHealth() {
    return this.request<{ status: string; environment: string; database: string; timestamp: string }>('/api/health');
  }

  async getDashboard() {
    return this.request<DashboardMetrics>('/api/dashboard');
  }

  async getUsers() {
    return this.request<{ users: User[] }>('/api/users');
  }

  async getUser(id: number | string) {
    return this.request<{
      user: User;
      payment_methods: PaymentMethod[];
      deposits: Deposit[];
      withdrawals: Withdrawal[];
      ledger_summary: {
        current_balance_cents: number;
        ledger_sum_cents: number;
        reconciled: boolean;
        entries_count: number;
      };
    }>(`/api/users/${id}`);
  }

  async getPaymentMethods() {
    return this.request<{ payment_methods: PaymentMethod[] }>('/api/payment-methods');
  }

  async getWithdrawals(params: { status?: string; user_id?: number } = {}) {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.user_id) searchParams.set('user_id', params.user_id.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<{ withdrawals: Withdrawal[]; total: number }>(`/api/withdrawals${query}`);
  }

  async getWithdrawal(id: number | string) {
    return this.request<{ withdrawal: Withdrawal }>(`/api/withdrawals/${id}`);
  }

  async createWithdrawal(data: CreateWithdrawalRequest) {
    return this.request<CreateWithdrawalResponse>('/api/withdrawals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLedger() {
    return this.request<LedgerViewResponse>('/api/ledger');
  }

  async getWebhooks() {
    return this.request<{ webhooks: WebhookEventRecord[] }>('/api/webhooks');
  }

  async postWebhook(event: Record<string, unknown>) {
    return this.request<{ status: string; message: string }>('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async getAuditLogs() {
    return this.request<{ audit_logs: AuditLogEvent[]; environment: string }>('/api/audit-logs');
  }
}

export const api = new ApiClient(API_BASE_URL);

// Currency and date utilities
export function formatCurrency(cents: number, currency = 'INR'): string {
  const amount = (cents || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
