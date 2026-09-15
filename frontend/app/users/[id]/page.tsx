'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Clock,
  ArrowDownToLine,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { api, formatCurrency, formatDateTime } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { User, PaymentMethod, Deposit, Withdrawal } from '@/types';

export default function UserProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<{
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
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.getUser(id);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs">
        <Clock className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
        Loading customer profile...
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
            <Link href="/users" className="text-xs text-blue-600 hover:underline">
              &larr; Back to Users
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-24 text-center space-y-3">
        <p className="text-sm font-semibold text-slate-700">User #{id} not found in database.</p>
        <Link href="/users" className="text-xs text-blue-600 hover:underline">
          &larr; Back to all users
        </Link>
      </div>
    );
  }


  const { user, payment_methods, deposits, withdrawals, ledger_summary } = data;

  return (
    <div className="space-y-8 pb-12">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Users
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{user.email}</h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                user_{user.id}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Member since {formatDateTime(user.created_at)}
            </p>
          </div>

          <Link
            href="/withdrawals/simulate"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <ArrowDownToLine className="w-4 h-4" /> Simulate Withdrawal for User
          </Link>
        </div>
      </div>

      {/* Balance & Reconciliation Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Current Account Balance
          </span>
          <div className="mt-2 text-2xl font-mono font-bold text-slate-900">
            {formatCurrency(user.balance_cents)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Available for withdrawal</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Ledger Sum Balance
          </span>
          <div className="mt-2 text-2xl font-mono font-bold text-slate-900">
            {formatCurrency(ledger_summary.ledger_sum_cents)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {ledger_summary.entries_count} immutable entries
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Reconciliation Check
          </span>
          <div className="mt-2 flex items-center gap-2">
            {ledger_summary.reconciled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-4 h-4" /> 100% Reconciled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertCircle className="w-4 h-4" /> Mismatch
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Balance equals ledger deltas
          </span>
        </div>
      </div>

      {/* Payment Instruments & Unrefunded Deposits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Instruments */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Payment Instruments</h2>
            <span className="text-xs font-medium text-slate-400">{payment_methods.length} Total</span>
          </div>

          <div className="space-y-2.5">
            {payment_methods.map((pm) => (
              <div
                key={pm.id}
                className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{pm.masked_token}</div>
                    <span className="font-mono text-[10px] text-slate-400 uppercase">
                      {pm.asset_class}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Verified
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Deposits & FIFO Principal */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Historical Deposits</h2>
              <p className="text-xs text-slate-400">Available principal for FIFO refund allocation</p>
            </div>
            <span className="text-xs font-medium text-slate-400">{deposits.length} Total</span>
          </div>

          <div className="space-y-2.5">
            {deposits.map((dep) => (
              <div
                key={dep.id}
                className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">{dep.payment_method_label}</div>
                  <div className="text-[10px] text-slate-400">
                    Settled: {formatDateTime(dep.settled_at)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">
                    {formatCurrency(dep.amount_cents)}
                  </div>
                  <div className="text-[10px] font-medium text-blue-600">
                    Unrefunded: {formatCurrency(dep.unrefunded_principal_cents)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Withdrawals */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Recent User Withdrawals</h2>
          <Link
            href="/withdrawals"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            All Withdrawals <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100 uppercase text-[10px]">
                <th className="py-2 font-semibold">ID</th>
                <th className="py-2 font-semibold">Amount</th>
                <th className="py-2 font-semibold">Status</th>
                <th className="py-2 font-semibold">Date</th>
                <th className="py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No withdrawals initiated by this customer yet.
                  </td>
                </tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 font-mono font-bold text-slate-900">wd_{w.id}</td>
                    <td className="py-2.5 font-mono font-bold text-slate-900">
                      {formatCurrency(w.amount_cents)}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={w.state} size="sm" />
                    </td>
                    <td className="py-2.5 text-slate-400">{formatDateTime(w.created_at)}</td>
                    <td className="py-2.5 text-right">
                      <Link
                        href={`/withdrawals/${w.id}`}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
