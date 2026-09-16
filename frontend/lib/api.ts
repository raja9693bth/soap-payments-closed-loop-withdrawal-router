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

export type BackendConnectionState = 'connected' | 'connecting' | 'waking' | 'unavailable';

export interface ConnectionStateEvent {
  state: BackendConnectionState;
  message: string;
  attempt: number;
  maxAttempts: number;
  elapsedMs: number;
}

type StateListener = (event: ConnectionStateEvent) => void;

class ApiClient {
  private baseUrl: string;
  private listeners: Set<StateListener> = new Set();
  private currentState: BackendConnectionState = 'connecting';
  private currentEvent: ConnectionStateEvent = {
    state: 'connecting',
    message: 'Connecting to sandbox backend…',
    attempt: 1,
    maxAttempts: 1,
    elapsedMs: 0,
  };
  private inFlightWakePromise: Promise<boolean> | null = null;
  private inFlightRequestsCount = 0;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentEvent);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(state: BackendConnectionState, message: string, attempt = 1, maxAttempts = 1, elapsedMs = 0) {
    this.currentState = state;
    this.currentEvent = { state, message, attempt, maxAttempts, elapsedMs };
    this.listeners.forEach((l) => {
      try {
        l(this.currentEvent);
      } catch (e) {
        console.error('State listener error:', e);
      }
    });
  }

  getConnectionState(): ConnectionStateEvent {
    return this.currentEvent;
  }

  /**
   * Bounded readiness / wake probe targeting GET /api/health.
   * Runs only when needed (cold-start / 502/503/timeout).
   * Validates: HTTP 200, status === "ok", database === "connected".
   * Multiple concurrent callers share the EXACT same in-flight probe promise (no request storm).
   * Automatically stops immediately when connected or when the recovery window (~70s) expires.
   */
  async wakeBackend(signal?: AbortSignal | null): Promise<boolean> {
    if (this.inFlightWakePromise) {
      return this.inFlightWakePromise;
    }

    if (this.currentState === 'connected') {
      return true;
    }

    this.inFlightWakePromise = (async () => {
      const cleanEndpoint = '/api/health';
      const healthUrl = this.baseUrl ? `${this.baseUrl}${cleanEndpoint}` : cleanEndpoint;
      const wakeStartTime = Date.now();
      const maxRecoveryWindowMs = 70000; // 70s maximum ceiling
      const probeTimeoutMs = 8000;
      let attempt = 0;

      this.notify('waking', 'Waking Sandbox Backend…', 1, 10, 0);

      while (Date.now() - wakeStartTime < maxRecoveryWindowMs) {
        if (signal?.aborted) {
          return false;
        }

        attempt++;
        const elapsed = Date.now() - wakeStartTime;
        this.notify('waking', 'Waking Sandbox Backend…', attempt, 10, elapsed);

        const probeController = new AbortController();
        const probeTimeout = setTimeout(() => probeController.abort(), probeTimeoutMs);

        const onParentAbort = () => probeController.abort();
        if (signal) {
          signal.addEventListener('abort', onParentAbort);
        }

        try {
          const resp = await fetch(healthUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: probeController.signal,
          });

          clearTimeout(probeTimeout);
          if (signal) {
            signal.removeEventListener('abort', onParentAbort);
          }

          if (resp.ok) {
            const data = await resp.json().catch(() => null);
            if (data && data.status === 'ok' && data.database === 'connected') {
              this.notify('connected', 'Sandbox Online', attempt, 10, Date.now() - wakeStartTime);
              return true;
            }
          }
        } catch {
          clearTimeout(probeTimeout);
          if (signal) {
            signal.removeEventListener('abort', onParentAbort);
          }
          if (signal?.aborted) {
            return false;
          }
        }

        // Bounded sleep with progressive backoff (3s to 5s)
        const sleepMs = Math.min(3000 + attempt * 500, 5000);
        await new Promise((r) => setTimeout(r, sleepMs));
      }

      this.notify('unavailable', 'Backend Unavailable', attempt, 10, Date.now() - wakeStartTime);
      return false;
    })().finally(() => {
      this.inFlightWakePromise = null;
    });

    return this.inFlightWakePromise;
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
      this.notify('unavailable', 'Backend configuration missing', 1, 1, 0);
      throw new SoapApiError({
        code: 'backend_unconfigured',
        status: 503,
        message: 'SOAP Payments API backend is not configured.',
        resolution: 'Set the NEXT_PUBLIC_API_BASE_URL environment variable in your Vercel project settings to your deployed Ruby API URL (e.g. on Render).',
      });
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = this.baseUrl ? `${this.baseUrl}${cleanEndpoint}` : cleanEndpoint;
    const method = (options.method || 'GET').toUpperCase();

    // CRITICAL FINTECH GUARDRAIL:
    // Only GET and HEAD read operations may use bounded recovery for cold boot.
    // POST/withdrawal operations are NEVER automatically retried to guarantee idempotency and financial safety.
    const isGetOrHead = method === 'GET' || method === 'HEAD';

    const requestStartTime = Date.now();
    this.inFlightRequestsCount++;

    // If currently not connected or waking, notify connecting
    if (this.currentState !== 'waking' && this.currentState !== 'connected') {
      this.notify('connecting', 'Connecting to sandbox backend…', 1, 1, 0);
    }

    // Proactive waking signal: if initial GET request takes > 3.5s, switch UI state to 'waking'
    let wakingTimer: NodeJS.Timeout | null = null;
    if (isGetOrHead && this.currentState !== 'connected') {
      wakingTimer = setTimeout(() => {
        if (this.currentState === 'connecting') {
          this.notify('waking', 'Waking Sandbox Backend…', 1, 1, Date.now() - requestStartTime);
        }
      }, 3500);
    }

    const executeFetch = async (targetSignal?: AbortSignal): Promise<{ ok: boolean; status: number; data: unknown }> => {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers,
        cache: 'no-store',
        signal: targetSignal,
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json().catch(() => null) : await response.text().catch(() => '');

      return { ok: response.ok, status: response.status, data };
    };

    try {
      // 1. Initial attempt with a generous 45s timeout to allow Render proxy buffering during cold spin-up
      const initialController = new AbortController();
      const initialTimeout = setTimeout(() => initialController.abort(), 45000);

      const onExternalAbort = () => initialController.abort();
      if (options.signal) {
        options.signal.addEventListener('abort', onExternalAbort);
      }

      let fetchResult: { ok: boolean; status: number; data: unknown };
      let transientError: unknown = null;

      try {
        fetchResult = await executeFetch(initialController.signal);
      } catch (err: unknown) {
        transientError = err;
        fetchResult = { ok: false, status: 0, data: null };
      } finally {
        clearTimeout(initialTimeout);
        if (wakingTimer) clearTimeout(wakingTimer);
        if (options.signal) {
          options.signal.removeEventListener('abort', onExternalAbort);
        }
      }

      // If caller aborted, rethrow immediately
      if (options.signal?.aborted) {
        throw new SoapApiError({
          code: 'request_aborted',
          status: 499,
          message: 'Request was cancelled.',
        });
      }

      // If initial request succeeded
      if (fetchResult.ok) {
        this.notify('connected', 'Sandbox Online', 1, 1, Date.now() - requestStartTime);
        return fetchResult.data as T;
      }

      // Check if this was a cold-start transient condition (502, 503, 504, or network drop / timeout)
      const isTransient =
        [502, 503, 504].includes(fetchResult.status) ||
        fetchResult.status === 0 ||
        (transientError && (transientError as Error).name === 'AbortError');

      // If it's a GET/HEAD request and transient, trigger the bounded wake coordinator!
      if (isGetOrHead && isTransient) {
        this.notify('waking', 'Waking Sandbox Backend…', 1, 10, Date.now() - requestStartTime);
        const woke = await this.wakeBackend(options.signal);

        if (options.signal?.aborted) {
          throw new SoapApiError({
            code: 'request_aborted',
            status: 499,
            message: 'Request was cancelled.',
          });
        }

        if (woke) {
          // Service is now awake and verified healthy! Execute the intended request once.
          const retryController = new AbortController();
          const retryTimeout = setTimeout(() => retryController.abort(), 15000);
          const onRetryAbort = () => retryController.abort();
          if (options.signal) {
            options.signal.addEventListener('abort', onRetryAbort);
          }

          try {
            const retryResult = await executeFetch(retryController.signal);
            if (retryResult.ok) {
              this.notify('connected', 'Sandbox Online', 1, 1, Date.now() - requestStartTime);
              return retryResult.data as T;
            }
            fetchResult = retryResult;
          } catch (retryErr: unknown) {
            transientError = retryErr;
          } finally {
            clearTimeout(retryTimeout);
            if (options.signal) {
              options.signal.removeEventListener('abort', onRetryAbort);
            }
          }
        }
      }

      // If we reach here and it was not successful:
      // Check for domain error response (e.g. 400, 401, 409, 422, etc.)
      if (fetchResult.status >= 400 && fetchResult.status < 500) {
        // Domain errors mean the backend IS connected and functional!
        this.notify('connected', 'Sandbox Online', 1, 1, Date.now() - requestStartTime);
        const errorObj =
          typeof fetchResult.data === 'object' && fetchResult.data !== null && 'error' in fetchResult.data
            ? (fetchResult.data as { error: { code?: string; message?: string } }).error
            : null;
        const code = errorObj?.code || `http_${fetchResult.status}`;
        const message = errorObj?.message || (typeof fetchResult.data === 'string' ? fetchResult.data : `HTTP ${fetchResult.status} error`);
        throw new SoapApiError(this.mapDomainError(code, message, fetchResult.status));
      }

      // If server returned a 5xx error or recovery failed
      this.notify('unavailable', 'Backend Unavailable', 1, 1, Date.now() - requestStartTime);

      if (transientError && (transientError as Error).name === 'AbortError' && !options.signal?.aborted) {
        throw new SoapApiError({
          code: 'request_timeout',
          status: 504,
          message: 'The request to the SOAP Payments backend timed out.',
          resolution: 'The free-tier Render service was waking from cold start and exceeded the recovery window. Click "Retry Connection" to try again.',
        });
      }

      const isProd = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      const targetHint = this.baseUrl || 'the API server';

      throw new SoapApiError({
        code: 'backend_unavailable',
        status: fetchResult.status || 503,
        message: isProd
          ? `Unable to connect to SOAP Payments backend at ${targetHint}. The service may still be waking up or offline.`
          : 'Unable to connect to SOAP Payments backend API. Please ensure the local Ruby API server is running on port 4567.',
        resolution: isProd
          ? 'The free-tier Render service was booting or unreachable. Click "Retry Connection" to reconnect.'
          : 'Run: bundle exec puma -p 4567 config.ru',
      });
    } finally {
      this.inFlightRequestsCount--;
      if (wakingTimer) clearTimeout(wakingTimer);
    }
  }

  async getHealth(options?: RequestInit) {
    return this.request<{ status: string; environment: string; database: string; timestamp: string }>('/api/health', options);
  }

  async getDashboard(range?: string, options?: RequestInit) {
    const query = range ? `?range=${encodeURIComponent(range)}` : '';
    return this.request<DashboardMetrics>(`/api/dashboard${query}`, options);
  }

  async getUsers(params: { q?: string; page?: number; page_size?: number } = {}, options?: RequestInit) {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.page_size) searchParams.set('page_size', params.page_size.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<{ users: User[]; pagination?: import('@/types').PaginationMeta; returned_count?: number }>(`/api/users${query}`, options);
  }

  async getUser(id: number | string, options?: RequestInit) {
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
    }>(`/api/users/${id}`, options);
  }

  async getPaymentMethods(options?: RequestInit) {
    return this.request<{ payment_methods: PaymentMethod[] }>('/api/payment-methods', options);
  }

  async getWithdrawals(params: { status?: string; user_id?: number; page?: number; page_size?: number; q?: string } = {}, options?: RequestInit) {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.user_id) searchParams.set('user_id', params.user_id.toString());
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.page_size) searchParams.set('page_size', params.page_size.toString());
    if (params.q) searchParams.set('q', params.q);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<{
      withdrawals: Withdrawal[];
      total: number;
      pagination?: import('@/types').PaginationMeta;
      returned_count?: number;
    }>(`/api/withdrawals${query}`, options);
  }

  async getWithdrawal(id: number | string, options?: RequestInit) {
    return this.request<{ withdrawal: Withdrawal }>(`/api/withdrawals/${id}`, options);
  }

  async createWithdrawal(data: CreateWithdrawalRequest, options?: RequestInit) {
    return this.request<CreateWithdrawalResponse>('/api/withdrawals', {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLedger(params: { page?: number; page_size?: number } = {}, options?: RequestInit) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.page_size) searchParams.set('page_size', params.page_size.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<LedgerViewResponse & { pagination?: import('@/types').PaginationMeta; returned_count?: number }>(`/api/ledger${query}`, options);
  }

  async getWebhooks(params: { page?: number; page_size?: number } = {}, options?: RequestInit) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.page_size) searchParams.set('page_size', params.page_size.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<{ webhooks: WebhookEventRecord[]; pagination?: import('@/types').PaginationMeta; returned_count?: number }>(`/api/webhooks${query}`, options);
  }

  async postWebhook(event: Record<string, unknown>, options?: RequestInit) {
    return this.request<{ status: string; message: string }>('/api/webhooks', {
      ...options,
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async getAuditLogs(options?: RequestInit) {
    return this.request<{ audit_logs: AuditLogEvent[]; activity_logs?: AuditLogEvent[]; environment: string }>(
      '/api/audit-logs',
      options
    );
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
