import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive?: boolean | null;
  };
  secondaryContext?: string;
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  trend,
  secondaryContext,
  badge,
}) => {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
          {value}
        </div>

        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center font-semibold ${
                trend.positive === true
                  ? 'text-emerald-600'
                  : trend.positive === false
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {trend.positive === true && <TrendingUp className="w-3.5 h-3.5 mr-1" />}
              {trend.positive === false && <TrendingDown className="w-3.5 h-3.5 mr-1" />}
              {trend.positive === null && <Minus className="w-3.5 h-3.5 mr-1" />}
              {trend.value}
            </span>
          )}

          {badge && (
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {badge}
            </span>
          )}

          {secondaryContext && (
            <span className="text-slate-400 font-normal">{secondaryContext}</span>
          )}
        </div>
      </div>
    </div>
  );
};
