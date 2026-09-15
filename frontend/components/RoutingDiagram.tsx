import React from 'react';
import { PayoutLeg, Deposit } from '@/types';
import { formatCurrency } from '@/lib/api';
import { ArrowRight, CreditCard, Landmark, Coins, ShieldCheck, RefreshCw } from 'lucide-react';

interface RoutingDiagramProps {
  originalDeposits?: Deposit[];
  legs: PayoutLeg[];
  totalAmountCents: number;
}

export const RoutingDiagram: React.FC<RoutingDiagramProps> = ({
  originalDeposits = [],
  legs = [],
  totalAmountCents,
}) => {
  const getInstrumentIcon = (assetClass?: string) => {
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
    <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-5 my-4">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Deterministic Closed-Loop Flow
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Total Route:</span>
          <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
            {formatCurrency(totalAmountCents)}
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600 font-medium">{legs.length} Payout {legs.length === 1 ? 'Leg' : 'Legs'}</span>
        </div>
      </div>

      {/* Visual Pipeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
        {/* LEFT COLUMN: Inbound / Original Instruments (FIFO Order) */}
        <div className="md:col-span-4 space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>1. Original Instruments (FIFO)</span>
            <span className="text-[10px] text-slate-400 font-normal">Oldest First</span>
          </div>

          {originalDeposits.length > 0 ? (
            originalDeposits.map((dep, idx) => (
              <div
                key={dep.id}
                className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600">
                    {idx + 1}
                  </span>
                  {getInstrumentIcon(dep.payment_method_asset_class)}
                  <div>
                    <div className="font-medium text-slate-800">{dep.payment_method_label}</div>
                    <div className="text-[10px] text-slate-400">
                      Unrefunded: {formatCurrency(dep.unrefunded_principal_cents)}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Refundable
                </span>
              </div>
            ))
          ) : (
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs text-xs text-slate-500 text-center py-4">
              Historical deposits matched via FIFO
            </div>
          )}
        </div>

        {/* CENTER COLUMN: Router Node */}
        <div className="md:col-span-3 flex flex-col items-center justify-center py-4 px-2">
          <div className="w-full flex items-center justify-center gap-2 text-slate-400 mb-2">
            <div className="h-[1px] flex-1 bg-slate-300" />
            <ArrowRight className="w-4 h-4 text-blue-600" />
            <div className="h-[1px] flex-1 bg-slate-300" />
          </div>

          <div className="bg-blue-900 text-white p-4 rounded-xl shadow-md text-center w-full border border-blue-800">
            <div className="w-8 h-8 rounded-lg bg-blue-600 mx-auto flex items-center justify-center mb-1.5 shadow-xs">
              <RefreshCw className="w-4 h-4 text-white" />
            </div>
            <div className="font-bold text-xs tracking-tight text-white">SOAP ROUTER</div>
            <div className="text-[10px] text-blue-200 font-medium">Closed-Loop Engine</div>
            <div className="mt-2 pt-2 border-t border-blue-800/80 text-[10px] text-blue-300 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> FIFO Resolution
            </div>
          </div>

          <div className="w-full flex items-center justify-center gap-2 text-slate-400 mt-2">
            <div className="h-[1px] flex-1 bg-slate-300" />
            <ArrowRight className="w-4 h-4 text-blue-600" />
            <div className="h-[1px] flex-1 bg-slate-300" />
          </div>
        </div>

        {/* RIGHT COLUMN: Payout Legs (Allocated) */}
        <div className="md:col-span-4 space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>2. Withdrawal Allocation</span>
            <span className="text-[10px] text-slate-400 font-normal">Executed Legs</span>
          </div>

          {legs.map((leg, idx) => (
            <div
              key={leg.id || idx}
              className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between text-xs hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-600">
                  {idx + 1}
                </span>
                {getInstrumentIcon(leg.payment_method_asset_class)}
                <div>
                  <div className="font-medium text-slate-900">{leg.payment_method_label}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <span
                      className={`font-semibold ${
                        leg.leg_type === 'refund' ? 'text-blue-600' : 'text-slate-600'
                      }`}
                    >
                      {leg.leg_type === 'refund' ? 'Closed-Loop Refund' : 'Residual Default Payout'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-slate-900">
                  {formatCurrency(leg.amount_cents)}
                </div>
                <span
                  className={`inline-block text-[10px] font-medium px-1.5 py-0.2 rounded uppercase ${
                    leg.state === 'settled'
                      ? 'text-emerald-700 bg-emerald-50'
                      : leg.state === 'failed'
                      ? 'text-rose-700 bg-rose-50'
                      : 'text-amber-700 bg-amber-50'
                  }`}
                >
                  {leg.state}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
