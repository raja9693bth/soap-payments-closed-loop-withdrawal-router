'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Play,
  Terminal,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function DevelopersPage() {
  const [copied, setCopied] = useState<string | null>(null);

  // Live "Try Request" console state
  const [tryMethod] = useState('GET');
  const [tryEndpoint, setTryEndpoint] = useState('/api/health');
  const [tryLoading, setTryLoading] = useState(false);
  const [tryResponse, setTryResponse] = useState<string | null>(null);
  const [tryLatency, setTryLatency] = useState<number | null>(null);
  const [tryStatus, setTryStatus] = useState<number | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRunRequest = async () => {
    const start = performance.now();
    try {
      setTryLoading(true);
      setTryResponse(null);
      setTryStatus(null);
      setTryLatency(null);

      if (tryEndpoint === '/api/health') {
        const res = await api.getHealth();
        setTryResponse(JSON.stringify(res, null, 2));
        setTryStatus(200);
      } else if (tryEndpoint === '/api/dashboard') {
        const res = await api.getDashboard();
        setTryResponse(JSON.stringify(res, null, 2));
        setTryStatus(200);
      } else if (tryEndpoint === '/api/ledger') {
        const res = await api.getLedger();
        setTryResponse(JSON.stringify(res, null, 2));
        setTryStatus(200);
      } else if (tryEndpoint === '/api/users') {
        const res = await api.getUsers();
        setTryResponse(JSON.stringify(res, null, 2));
        setTryStatus(200);
      }
      setTryLatency(Math.round(performance.now() - start));
    } catch (err: unknown) {
      setTryLatency(Math.round(performance.now() - start));
      setTryStatus(500);
      setTryResponse(JSON.stringify({ error: (err as Error).message }, null, 2));
    } finally {
      setTryLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Integration Reference
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Developer API
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Direct HTTP contracts, database-backed idempotency specifications, error codes, and live API test console.
          </p>
        </div>
      </div>

      {/* Interactive Try Request Console */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Live API Test Console</h2>
          </div>
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Connected to Ruby Engine
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center w-full sm:w-auto">
            <span className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-l-lg font-mono text-xs font-bold text-slate-700">
              {tryMethod}
            </span>
            <div className="relative w-full sm:w-64">
              <select
                value={tryEndpoint}
                onChange={(e) => setTryEndpoint(e.target.value)}
                className="px-3 pr-8 py-2 border-y border-r border-slate-300 rounded-r-lg bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full appearance-none cursor-pointer"
              >
                <option value="/api/health">/api/health</option>
                <option value="/api/dashboard">/api/dashboard</option>
                <option value="/api/ledger">/api/ledger</option>
                <option value="/api/users">/api/users</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <span className="text-[10px]">▼</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRunRequest}
            disabled={tryLoading}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" /> {tryLoading ? 'Executing...' : 'Run Request'}
          </button>
        </div>

        {tryResponse && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-white text-[11px] ${tryStatus === 200 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                  {tryStatus} {tryStatus === 200 ? 'OK' : 'ERROR'}
                </span>
                {tryLatency !== null && (
                  <span className="text-slate-500 text-[11px] font-mono">
                    Latency: <span className="font-semibold text-slate-800">{tryLatency}ms</span>
                  </span>
                )}
              </div>
              <button
                onClick={() => copyToClipboard(tryResponse, 'try_res')}
                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded bg-slate-50 cursor-pointer"
              >
                {copied === 'try_res' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copied === 'try_res' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto max-h-60">
              {tryResponse}
            </pre>
          </div>
        )}
      </div>


      {/* Core API Reference Documentation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* POST /api/withdrawals */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-bold">POST</span>
              <span className="font-bold text-slate-900">/api/withdrawals</span>
            </div>
            <button
              onClick={() => copyToClipboard('POST /api/withdrawals', 'post_wd')}
              className="text-slate-400 hover:text-slate-600"
            >
              {copied === 'post_wd' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <p className="text-xs text-slate-600">
            Executes a FIFO closed-loop withdrawal. Allocates refunds to original deposit instruments
            first; routes excess to default payout method.
          </p>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">JSON Request Body</span>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto">
{`{
  "user_id": 1,
  "amount_cents": 800000,
  "default_payout_method_id": 4,
  "idempotency_key": "prod_wd_9a8b7c"
}`}
            </pre>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Expected 201 Response</span>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg font-mono text-xs overflow-x-auto">
{`{
  "status": "ok",
  "withdrawal_id": 14,
  "legs": [
    { "amount_cents": 300000, "leg_type": "refund" },
    { "amount_cents": 200000, "leg_type": "refund" },
    { "amount_cents": 300000, "leg_type": "residual_payout" }
  ]
}`}
            </pre>
          </div>
        </div>

        {/* Idempotency & Error Invariants */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Supported HTTP Error Contracts</h2>
            <p className="text-xs text-slate-400">Deterministic failure modes returned by domain engine</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                <span>409 Conflict</span>
                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">idempotency_conflict</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Returned when an idempotency key is submitted with a different request body or parameters.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                <span>422 Unprocessable</span>
                <span className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded">insufficient_funds</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Returned when user balance is lower than the requested withdrawal amount under row lock.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                <span>422 Unprocessable</span>
                <span className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded">cross_asset_refused</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Refuses withdrawal when remaining unrefunded principal crosses asset families (e.g. crypto vs fiat).
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                <span>403 Forbidden</span>
                <span className="text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded">unauthorized_payout_method</span>
              </div>
              <p className="text-slate-600 text-[11px]">
                Validates that default payout destination belongs to the authenticated balance owner.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
