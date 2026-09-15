'use client';

import React, { useState, useEffect } from 'react';
import { Key, Webhook, Server, ShieldCheck, Copy, Check, Info } from 'lucide-react';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('/api/webhooks');

  useEffect(() => {
    const base = api.getBaseUrl();
    if (base) {
      setWebhookUrl(`${base}/api/webhooks`);
    } else if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/webhooks`);
    }
  }, []);

  const copyToClipboard = (text: string, type: 'key' | 'webhook') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Configuration &amp; Diagnostics
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Sandbox Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Configure sandbox testing parameters, inspect simulated API contracts, and review
            mathematical invariant assurances.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Mode: Developer Sandbox
        </div>
      </div>

      {/* Honest Scope Banner */}
      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200/80 flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Portfolio Demonstration Notice: </span>
          This system is an unauthenticated, isolated developer sandbox. No live banking credentials,
          real PANs, or actual funds are handled. All payment instruments and accounts are simulated
          using deterministic sandbox test data.
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Environment & Rails */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Server className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Deployment Architecture</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Frontend Target</span>
              <span className="font-mono font-semibold text-slate-800 mt-1 block">
                Next.js 15 on Vercel Edge
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Backend API Target</span>
              <span className="font-mono font-semibold text-slate-800 mt-1 block">
                Ruby 3.3 / Sinatra on Render
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Database Layer</span>
              <span className="font-mono font-semibold text-slate-800 mt-1 block">
                PostgreSQL (Append-Only Double-Entry Ledger)
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Domain Engine</span>
              <span className="font-mono font-semibold text-slate-800 mt-1 block">
                Authoritative Orchestration Services
              </span>
            </div>
          </div>
        </div>

        {/* API Credentials */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Key className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">Sandbox API Access</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between max-w-md">
                <span className="text-slate-500 font-medium block">Sandbox Demonstration Key</span>
                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Demo Only
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value="soap_pub_sandbox_demo_key_unrestricted"
                  className="w-full max-w-md px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700 select-all"
                  aria-label="Sandbox Public Key"
                />
                <button
                  onClick={() => copyToClipboard('soap_pub_sandbox_demo_key_unrestricted', 'key')}
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors shadow-2xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  title="Copy Demo Key"
                  aria-label="Copy Demo Key"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                This sandbox key is unauthenticated for public portfolio evaluation. No real customer data is accessed.
              </p>
            </div>
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Webhook className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">Sandbox Webhook Configuration</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Sandbox Ingestion Endpoint</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full max-w-md px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700 select-all"
                  aria-label="Webhook Callback URL"
                />
                <button
                  onClick={() => copyToClipboard(webhookUrl, 'webhook')}
                  className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors shadow-2xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  title="Copy Ingestion URL"
                  aria-label="Copy Ingestion URL"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Resolved to current deployment environment. Accepts simulated provider callbacks (success, failure, late failure).
              </p>
            </div>

            <div>
              <span className="text-slate-500 font-medium block">HMAC Signing Secret (Sandbox Example)</span>
              <input
                type="text"
                readOnly
                value="whsec_sandbox_demo_key_untrusted"
                className="w-full max-w-md px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500 mt-1 select-all"
                aria-label="Sandbox Signing Secret"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Permissive in sandbox test mode; verified with HMAC-SHA256 constant-time comparison when header is provided.
              </p>
            </div>
          </div>
        </div>

        {/* Security & Invariant Guarantee */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Verified System Invariants</h2>
          </div>

          <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
            <li>
              <span className="font-semibold text-slate-800">Pessimistic Balance Row Locking: </span>
              Database-level row locks ensure zero balance drift under concurrent withdrawal attempts.
            </li>
            <li>
              <span className="font-semibold text-slate-800">Database Idempotency Store: </span>
              Prevents double payouts; payload tampering returns <code>409 Conflict</code>.
            </li>
            <li>
              <span className="font-semibold text-slate-800">FIFO Closed-Loop Refund: </span>
              Refunds originating deposit methods chronologically before releasing residual payout.
            </li>
            <li>
              <span className="font-semibold text-slate-800">Asset-Family Isolation: </span>
              Rejects cross-asset fund leakage (e.g. fiat card to cryptocurrency).
            </li>
            <li>
              <span className="font-semibold text-slate-800">Double-Entry Append-Only Ledger: </span>
              Mathematical equality between account balance and the sum of ledger deltas.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
