'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Copy,
  Check,
  Clock,
  BookOpenCheck,
  Webhook,
} from 'lucide-react';
import { api, formatCurrency, formatDateTime } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { Timeline } from '@/components/Timeline';
import { Withdrawal } from '@/types';

export default function WithdrawalDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const fetchWithdrawal = useCallback(async () => {
    try {
      const data = await api.getWithdrawal(id);
      setWithdrawal(data.withdrawal);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load withdrawal details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchWithdrawal();
  }, [fetchWithdrawal]);

  useEffect(() => {
    fetchWithdrawal();
  }, [fetchWithdrawal]);

  const copyId = () => {
    navigator.clipboard.writeText(`wd_${id}`);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs">
        <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
        Loading withdrawal wd_{id}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-3 text-left">
          <div className="font-bold text-rose-800 flex items-center gap-2">
            <span>Backend Connection Error</span>
          </div>
          <p className="text-slate-700">{error}</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-rose-300 text-rose-800 font-semibold hover:bg-rose-100/60 transition-colors cursor-pointer text-xs"
            >
              Retry
            </button>
            <Link href="/withdrawals" className="text-xs text-blue-600 hover:underline">
              &larr; Back to Withdrawals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!withdrawal) {
    return (
      <div className="py-24 text-center space-y-3">
        <p className="text-sm font-semibold text-slate-700">Withdrawal wd_{id} not found in database.</p>
        <Link href="/withdrawals" className="text-xs text-blue-600 hover:underline">
          &larr; Back to all withdrawals
        </Link>
      </div>
    );
  }


  return (
    <div className="space-y-8 pb-12">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/withdrawals"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Withdrawals
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-mono font-bold tracking-tight text-slate-900">
              wd_{withdrawal.id}
            </h1>
            <StatusBadge status={withdrawal.state} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors shadow-2xs"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId ? 'Copied' : 'Copy ID'}
            </button>
            <Link
              href="/ledger"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors shadow-2xs"
            >
              <BookOpenCheck className="w-3.5 h-3.5 text-blue-600" /> View Ledger
            </Link>
          </div>
        </div>
      </div>

      {/* Two-Column Enterprise Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* PRIMARY COLUMN (8 cols): Operational Data */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Payout Legs Routing Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Routing Breakdown</h2>
                <p className="text-xs text-slate-400">Allocated payout legs dispatched via ClosedLoopResolver</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                {withdrawal.legs?.length || 0} Payout Legs
              </span>
            </div>

            <div className="space-y-3">
              {(withdrawal.legs || []).map((leg, idx) => (
                <div
                  key={leg.id}
                  className="p-4 rounded-lg border border-slate-200/90 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                        <span>{leg.payment_method_label}</span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                            leg.leg_type === 'refund'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {leg.leg_type === 'refund' ? 'Closed-Loop Refund' : 'Default Residual Payout'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        External ID: {leg.external_id || 'none (internal)'}
                      </div>
                      {leg.failure_code && (
                        <div className="text-[11px] text-rose-600 font-mono mt-0.5">
                          Failure code: {leg.failure_code}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-slate-900">
                      {formatCurrency(leg.amount_cents)}
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={leg.state} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Event Timeline */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Lifecycle Timeline</h2>
              <p className="text-xs text-slate-400">Chronological execution and settlement milestones</p>
            </div>

            <Timeline events={withdrawal.timeline || []} />
          </div>

          {/* 3. Related Ledger Entries */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Financial Ledger Entries</h2>
                <p className="text-xs text-slate-400">Append-only audit trail debits and reversals</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Immutable</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100 uppercase text-[10px]">
                    <th className="py-2 font-semibold">Entry ID</th>
                    <th className="py-2 font-semibold">Type</th>
                    <th className="py-2 font-semibold">Amount</th>
                    <th className="py-2 font-semibold">Reference</th>
                    <th className="py-2 font-semibold text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(withdrawal.ledger_entries || []).map((le) => (
                    <tr key={le.id}>
                      <td className="py-2 font-mono text-slate-700">le_{le.id}</td>
                      <td className="py-2">
                        <span
                          className={`font-semibold ${
                            le.entry_type === 'withdrawal_debit'
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {le.entry_type}
                        </span>
                      </td>
                      <td className="py-2 font-mono font-bold text-slate-900">
                        {formatCurrency(le.amount_cents)}
                      </td>
                      <td className="py-2 font-mono text-slate-500 text-[11px]">{le.reference}</td>
                      <td className="py-2 text-slate-400 text-right">{formatDateTime(le.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECONDARY COLUMN (4 cols): Static Metadata & Context */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Withdrawal Summary
            </h3>

            <div className="divide-y divide-slate-100 text-xs space-y-2.5">
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500">Gross Amount</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {formatCurrency(withdrawal.amount_cents)}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500">User Account</span>
                <Link
                  href={`/users/${withdrawal.user_id}`}
                  className="text-blue-600 font-medium hover:underline truncate max-w-[150px]"
                >
                  {withdrawal.user_email || `User #${withdrawal.user_id}`}
                </Link>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500">Asset Class</span>
                <span className="font-medium text-slate-800">INR / Fiat</span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500">Idempotency Key</span>
                <span className="font-mono text-[11px] text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                  {withdrawal.idempotency_key_masked || 'demo_...'}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500">Request Fingerprint</span>
                <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                  {withdrawal.request_fingerprint ? withdrawal.request_fingerprint.slice(0, 16) : '—'}...
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500">Created At</span>
                <span className="text-slate-600 text-[11px]">
                  {formatDateTime(withdrawal.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Related Webhook Ingestion */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Webhook Deliveries
                </h3>
              </div>
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Replay Safe
              </span>
            </div>

            {(withdrawal.webhook_events || []).length > 0 ? (
              <div className="space-y-2 text-xs">
                {(withdrawal.webhook_events || []).map((we) => (
                  <div key={we.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-mono font-semibold text-slate-800 text-[11px]">{we.event_type}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">ID: {we.external_event_id}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">
                Synchronous settlement. No async webhook callbacks required for this leg.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
