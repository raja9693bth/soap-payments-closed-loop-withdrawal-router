'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { api, formatCurrency, formatDateTime } from '@/lib/api';
import { ReconciliationBanner } from '@/components/ReconciliationBanner';
import { LedgerViewResponse } from '@/types';

export default function LedgerPage() {
  const [data, setData] = useState<LedgerViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    try {
      const res = await api.getLedger();
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load ledger from backend');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Financial Integrity
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Append-Only Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Immutable, audit-ready double-entry ledger verifying all balance movements, reservations,
            and provider compensation reversals.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto cursor-pointer disabled:opacity-50"
          title="Refresh Ledger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Backend Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>Backend Error: Unable to fetch ledger telemetry</span>
            </div>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-rose-300 text-rose-800 font-semibold hover:bg-rose-100/60 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
          <p className="text-slate-700">{error}</p>
        </div>
      )}

      {/* Reconciliation Banner */}
      {data && (
        <ReconciliationBanner
          reconciled={data.reconciled}
          totalBalanceCents={data.metrics.total_balance_cents}
          totalLedgerCents={data.metrics.total_ledger_cents}
          entriesCount={data.metrics.entries_count}
        />
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total User Balances</span>
            <div className="text-xl font-mono font-bold text-slate-900 mt-1">
              {formatCurrency(data.metrics.total_balance_cents)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Net Ledger Sum</span>
            <div className="text-xl font-mono font-bold text-slate-900 mt-1">
              {formatCurrency(data.metrics.total_ledger_cents)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Debits (-)</span>
            <div className="text-xl font-mono font-bold text-rose-600 mt-1">
              -{formatCurrency(data.metrics.total_debits_cents)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Credits (+)</span>
            <div className="text-xl font-mono font-bold text-emerald-600 mt-1">
              +{formatCurrency(data.metrics.total_credits_cents)}
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-semibold">Entry ID</th>
                <th className="py-3 px-4 font-semibold">Account / User</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Signed Amount</th>
                <th className="py-3 px-4 font-semibold">Audit Reference</th>
                <th className="py-3 px-4 font-semibold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Verifying ledger transactions...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Unable to display ledger entries due to backend connection failure.
                  </td>
                </tr>
              ) : (data?.entries || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No ledger entries recorded yet.
                  </td>
                </tr>
              ) : (

                data?.entries.map((entry) => {
                  const isDebit = entry.amount_cents < 0;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        le_{entry.id}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <Link
                          href={`/users/${entry.user_id}`}
                          className="hover:text-blue-600 hover:underline font-medium"
                        >
                          {entry.user_email || `User #${entry.user_id}`}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold capitalize ${
                            isDebit ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {entry.entry_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            isDebit ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {isDebit ? (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          {isDebit
                            ? `-${formatCurrency(Math.abs(entry.amount_cents))}`
                            : `+${formatCurrency(entry.amount_cents)}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {entry.reference}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-right">
                        {formatDateTime(entry.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
