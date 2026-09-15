'use client';

import React from 'react';
import { Key, Webhook, Server, Lock } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Configuration &amp; Security
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            System Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Configure environment parameters, security headers, and sandbox testing preferences.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Environment: Sandbox
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Environment & Rails */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Server className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Environment Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Deployment Target</span>
              <span className="font-mono font-semibold text-slate-800 mt-1 block">
                Frontend: Vercel | API: Render
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Database Layer</span>
              <span className="font-mono font-semibold text-slate-800 mt-1 block">
                PostgreSQL (Strict Append-Only Ledger)
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Domain Engine Version</span>
              <span className="font-mono font-semibold text-slate-800 mt-1 block">v1.0.0 (Authoritative)</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Idempotency Retention</span>
              <span className="font-mono font-semibold text-slate-800 mt-1 block">Permanent Key Store</span>
            </div>
          </div>
        </div>

        {/* API Credentials */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Key className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">API Credentials</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Sandbox Public Key</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value="soap_pub_sandbox_0a9b8c7d6e5f4a3b2c1d0e"
                  className="w-full max-w-md px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700"
                />
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-medium block">Secret Key (Masked)</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="password"
                  readOnly
                  value="soap_sec_sandbox_••••••••••••••••••••••••••••"
                  className="w-full max-w-md px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Production secrets are strictly injected through environment variables and never logged or exposed.
              </p>
            </div>
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Webhook className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-slate-900">Webhook Endpoints</h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Callback Ingestion URL</span>
              <input
                type="text"
                readOnly
                value="https://api.soappayments.com/api/webhooks"
                className="w-full max-w-md px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-700 mt-1"
              />
            </div>

            <div>
              <span className="text-slate-500 font-medium block">Webhook Signing Secret</span>
              <input
                type="password"
                readOnly
                value="whsec_••••••••••••••••••••••••••••"
                className="w-full max-w-md px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-500 mt-1"
              />
            </div>
          </div>
        </div>

        {/* Security & Invariant Guarantee */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Security &amp; Invariant Assurances</h2>
          </div>

          <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
            <li>Pessimistic row locking ensures zero balance races under high concurrency.</li>
            <li>Idempotency keys deduplicate requests and reject parameter tampering.</li>
            <li>Strict asset-family boundary protects against cross-asset fund leakage.</li>
            <li>Immutable ledger prevents balance divergence with zero destructive updates.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
