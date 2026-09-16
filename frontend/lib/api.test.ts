import test from 'node:test';
import assert from 'node:assert';
// @ts-expect-error TS5097: Node ESM strip-types runner requires explicit .ts extension
import { ApiClient, SoapApiError } from './api.ts';

test('Initial connection state is connecting and not connected', () => {
  const client = new ApiClient('http://test-api.local');
  const state = client.getConnectionState();

  assert.strictEqual(state.state, 'connecting', 'Initial state must be connecting');
  assert.strictEqual(state.message, 'Connecting to sandbox backend…');
  assert.strictEqual(state.attempt, 1);
  assert.strictEqual(state.maxAttempts, 1);
  assert.strictEqual(state.elapsedMs, 0);

  let notifiedState = '';
  const unsubscribe = client.subscribe((event) => {
    notifiedState = event.state;
  });
  assert.strictEqual(notifiedState, 'connecting', 'Subscriber must immediately receive connecting state');
  unsubscribe();
});

test('POST /api/withdrawals is NEVER automatically retried by client on 502/network failure', async () => {
  const client = new ApiClient('http://test-api.local');
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  const calls: { url: string; method: string }[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCallCount++;
    const url = input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    calls.push({ url, method });

    // Simulate cold-start 502 Bad Gateway from Render proxy
    return new Response(JSON.stringify({ error: 'Bad Gateway' }), {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;

  try {
    await client.createWithdrawal({
      user_id: 1,
      amount_cents: 5000,
      default_payout_method_id: 1,
      idempotency_key: 'idem_test_prevent_retry_123',
    });
    assert.fail('Expected createWithdrawal to throw on 502, but it resolved');
  } catch (err) {
    assert.ok(err instanceof SoapApiError, 'Error should be a SoapApiError');
    assert.strictEqual((err as SoapApiError).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // CRITICAL FINTECH SAFETY ASSERTIONS:
  // Must make EXACTLY ONE fetch call. Zero retries.
  assert.strictEqual(fetchCallCount, 1, 'POST /api/withdrawals must execute exactly 1 attempt (NO RETRIES)');
  assert.strictEqual(calls[0].method, 'POST');
  assert.strictEqual(calls[0].url, 'http://test-api.local/api/withdrawals');

  const finalState = client.getConnectionState();
  assert.strictEqual(finalState.state, 'unavailable');
  assert.strictEqual(finalState.attempt, 1);
  assert.strictEqual(finalState.maxAttempts, 1);
});

test('POST to other endpoints (e.g. /api/webhooks) is NEVER automatically retried on 503', async () => {
  const client = new ApiClient('http://test-api.local');
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  const calls: { url: string; method: string }[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCallCount++;
    const url = input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    calls.push({ url, method });

    return new Response(JSON.stringify({ error: 'Service Unavailable' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;

  try {
    await client.postWebhook({ event: 'payout.settled', id: 'evt_123' });
    assert.fail('Expected postWebhook to throw on 503');
  } catch (err) {
    assert.ok(err instanceof SoapApiError);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.strictEqual(fetchCallCount, 1, 'POST /api/webhooks must execute exactly 1 attempt (NO RETRIES)');
  assert.strictEqual(calls[0].method, 'POST');
});

test('GET /api/withdrawals allows bounded cold-start recovery when backend wakes', async () => {
  const client = new ApiClient('http://test-api.local');
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  const calls: { url: string; method: string }[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCallCount++;
    const url = input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    calls.push({ url, method });

    if (fetchCallCount === 1) {
      // 1. Initial GET /api/withdrawals returns 502 while booting
      return new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    }

    if (url.includes('/api/health')) {
      // 2. Wake probe checks /api/health and finds service healthy
      return new Response(JSON.stringify({ status: 'ok', database: 'connected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Subsequent request succeeds with data
    return new Response(JSON.stringify({ withdrawals: [], total: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;

  let result;
  try {
    result = await client.getWithdrawals();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(result, 'GET /api/withdrawals should successfully recover');
  assert.strictEqual(calls[0].method, 'GET');
  assert.ok(fetchCallCount >= 2, 'GET operations are allowed bounded recovery');
  assert.strictEqual(client.getConnectionState().state, 'connected');
});

test('HEAD /api/... allows bounded cold-start recovery', async () => {
  const client = new ApiClient('http://test-api.local');
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;
  const calls: { url: string; method: string }[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCallCount++;
    const url = input.toString();
    const method = (init?.method || 'GET').toUpperCase();
    calls.push({ url, method });

    if (fetchCallCount === 1) {
      return new Response('', { status: 504, statusText: 'Gateway Timeout' });
    }

    if (url.includes('/api/health')) {
      return new Response(JSON.stringify({ status: 'ok', database: 'connected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('', { status: 200 });
  }) as typeof globalThis.fetch;

  try {
    // Calling internal request with HEAD
    // @ts-expect-error accessing private request method for unit testing
    await client.request('/api/health', { method: 'HEAD' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.strictEqual(calls[0].method, 'HEAD');
  assert.ok(fetchCallCount >= 2, 'HEAD operations are allowed bounded recovery');
  assert.strictEqual(client.getConnectionState().state, 'connected');
});

test('Domain error (409 conflict, 422, etc.) is not retried and transitions state to connected', async () => {
  const client = new ApiClient('http://test-api.local');
  const originalFetch = globalThis.fetch;
  let fetchCallCount = 0;

  globalThis.fetch = (async () => {
    fetchCallCount++;
    return new Response(
      JSON.stringify({
        error: {
          code: 'idempotency_conflict',
          message: 'Conflict with prior request',
        },
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }) as typeof globalThis.fetch;

  try {
    await client.createWithdrawal({
      user_id: 1,
      amount_cents: 5000,
      default_payout_method_id: 1,
      idempotency_key: 'idem_conflict',
    });
    assert.fail('Expected 409 error');
  } catch (err) {
    assert.ok(err instanceof SoapApiError);
    assert.strictEqual((err as SoapApiError).code, 'idempotency_conflict');
    assert.strictEqual((err as SoapApiError).status, 409);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.strictEqual(fetchCallCount, 1, '409 Conflict must not be retried');
  assert.strictEqual(client.getConnectionState().state, 'connected', 'Valid domain error means backend is connected');
});

test('cancellation: no retry after AbortController cancellation', async () => {
  const client = new ApiClient('http://test-api.local');
  const originalFetch = globalThis.fetch;
  let dashboardCalls = 0;
  let healthCalls = 0;
  const abortController = new AbortController();

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.includes('/api/dashboard')) {
      dashboardCalls++;
      // 1. First attempt returns 502 to trigger recovery
      // Cancel the caller right during recovery
      setTimeout(() => abortController.abort(), 10);
      return new Response('Bad Gateway', { status: 502 });
    }

    if (url.includes('/api/health')) {
      healthCalls++;
      // Slow health probe
      await new Promise((r) => setTimeout(r, 100));
      return new Response(JSON.stringify({ status: 'ok', database: 'connected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof globalThis.fetch;

  try {
    await client.getDashboard('7d', { signal: abortController.signal });
    assert.fail('Expected aborted request to throw');
  } catch (err) {
    assert.ok(err instanceof SoapApiError, 'Expected SoapApiError');
    assert.strictEqual((err as SoapApiError).code, 'request_aborted');
    assert.strictEqual((err as SoapApiError).status, 499);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Caller cancelled, so the caller must not execute the second dashboard request attempt
  assert.strictEqual(dashboardCalls, 1, 'Cancelled request must not execute dashboard retries');
  assert.strictEqual(healthCalls, 1, 'Background health wake probe ran independently');
  assert.notStrictEqual(client.getConnectionState().state, 'unavailable', 'Cancelled request must not mark backend unavailable');
});

test('shared wake coordinator: concurrent readers do not create multiple wake loops', async () => {
  const client = new ApiClient('http://test-api.local');
  const originalFetch = globalThis.fetch;
  let healthProbeCount = 0;
  let dashboardCalls = 0;
  let withdrawalsCalls = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.includes('/api/health')) {
      healthProbeCount++;
      // Return success on probe
      return new Response(JSON.stringify({ status: 'ok', database: 'connected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/api/dashboard')) {
      dashboardCalls++;
      if (dashboardCalls === 1) {
        return new Response('Bad Gateway', { status: 502 });
      }
      return new Response(JSON.stringify({ kpis: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('/api/withdrawals')) {
      withdrawalsCalls++;
      if (withdrawalsCalls === 1) {
        return new Response('Bad Gateway', { status: 502 });
      }
      return new Response(JSON.stringify({ withdrawals: [], total: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('', { status: 200 });
  }) as typeof globalThis.fetch;

  try {
    // Launch two readers concurrently while backend is booting
    const [dashRes, withRes] = await Promise.all([
      client.getDashboard('7d'),
      client.getWithdrawals(),
    ]);

    assert.ok(dashRes, 'Dashboard resolved successfully');
    assert.ok(withRes, 'Withdrawals resolved successfully');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Exactly ONE health probe cycle was executed, shared across both readers!
  assert.strictEqual(healthProbeCount, 1, 'Concurrent readers must share exactly ONE in-flight health wake operation');
  assert.strictEqual(client.getConnectionState().state, 'connected');
});

