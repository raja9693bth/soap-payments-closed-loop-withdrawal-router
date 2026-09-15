import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/api';

interface ReconciliationBannerProps {
  reconciled: boolean;
  totalBalanceCents: number;
  totalLedgerCents: number;
  entriesCount?: number;
}

export const ReconciliationBanner: React.FC<ReconciliationBannerProps> = ({
  reconciled,
  totalBalanceCents,
  totalLedgerCents,
  entriesCount,
}) => {
  return (
    <div
      className={`rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        reconciled
          ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
          : 'bg-rose-50 border-rose-200 text-rose-950'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            reconciled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {reconciled ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
        </div>
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            <span>{reconciled ? 'Append-Only Ledger Reconciled' : 'Reconciliation Mismatch Detected'}</span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                reconciled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {reconciled ? '100% Balanced' : 'Action Required'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            {reconciled
              ? `All account balances match the sum of immutable ledger transactions (${entriesCount || 0} entries verified).`
              : 'Discrepancy detected between active user balances and append-only ledger entries.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs shrink-0 self-end sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Current Balance</span>
          <span className="font-mono font-bold text-slate-900">{formatCurrency(totalBalanceCents)}</span>
        </div>
        <div className="text-slate-400 font-bold">=</div>
        <div>
          <span className="text-slate-500 block text-[10px] uppercase font-semibold">Ledger Net</span>
          <span className="font-mono font-bold text-slate-900">{formatCurrency(totalLedgerCents)}</span>
        </div>
      </div>
    </div>
  );
};
