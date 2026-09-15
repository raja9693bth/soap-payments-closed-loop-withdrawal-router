'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CreditCard, Landmark, Coins, ShieldCheck, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import { api, formatDateTime } from '@/lib/api';
import { PaymentMethod } from '@/types';

export default function PaymentInstrumentsPage() {
  const [instruments, setInstruments] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInstruments = useCallback(async () => {
    try {
      const data = await api.getPaymentMethods();
      setInstruments(data.payment_methods || []);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load payment instruments from backend');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    loadInstruments();
  }, [loadInstruments]);

  useEffect(() => {
    loadInstruments();
  }, [loadInstruments]);

  const getIcon = (assetClass: string) => {
    switch (assetClass) {
      case 'crypto':
        return <Coins className="w-4 h-4 text-purple-600" />;
      case 'fiat_ach':
        return <Landmark className="w-4 h-4 text-blue-600" />;
      default:
        return <CreditCard className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Financial Instruments
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Payment Instruments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Registered customer payment methods, asset families, and tokenized payout rails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Instruments"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
            <Lock className="w-3.5 h-3.5" /> PCI Safe: Tokens Strictly Masked
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Backend Error: Unable to load payment instruments</span>
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

      {/* Instruments Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-semibold">Instrument ID</th>
                <th className="py-3 px-4 font-semibold">Masked Identifier</th>
                <th className="py-3 px-4 font-semibold">Asset Class</th>
                <th className="py-3 px-4 font-semibold">Owner</th>
                <th className="py-3 px-4 font-semibold">Verification</th>
                <th className="py-3 px-4 font-semibold text-right">Added At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading payment instruments...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Unable to display instruments due to backend connection failure.
                  </td>
                </tr>
              ) : instruments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No payment instruments registered in the database.
                  </td>
                </tr>
              ) : (
                instruments.map((pm) => (
                  <tr key={pm.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      pm_{pm.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                          {getIcon(pm.asset_class)}
                        </div>
                        <span className="font-semibold text-slate-900">{pm.masked_token}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono uppercase text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {pm.asset_class}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <Link
                        href={`/users/${pm.user_id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {pm.user_email || `User #${pm.user_id}`}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" /> Tokenized
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-right">
                      {formatDateTime(pm.created_at)}
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
