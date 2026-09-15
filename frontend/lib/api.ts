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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin.replace(':3000', ':4567') : 'http://127.0.0.1:4567');

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error?.message || `HTTP ${response.status} error`);
        (error as unknown as { code: string; status: number }).code = data.error?.code || 'unknown_error';
        (error as unknown as { code: string; status: number }).status = response.status;
        throw error;
      }

      return data as T;
    } catch (err: unknown) {
      if ((err as { code?: string }).code) {
        throw err;
      }
      const networkError = new Error('Unable to connect to SOAP Payments backend API. Please ensure the Ruby API server is running on port 4567.');
      (networkError as unknown as { code: string; status: number }).code = 'connection_refused';
      (networkError as unknown as { code: string; status: number }).status = 503;
      throw networkError;
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
  const amount = cents / 100;
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
