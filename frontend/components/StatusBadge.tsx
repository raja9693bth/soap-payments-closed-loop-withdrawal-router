import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toLowerCase();

  let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = Clock;
  let label = status;

  switch (normalized) {
    case 'settled':
    case 'completed':
    case 'success':
    case 'healthy':
      colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      Icon = CheckCircle2;
      label = 'Settled';
      break;
    case 'submitted':
    case 'processing':
      colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
      Icon = Clock;
      label = 'Submitted';
      break;
    case 'pending':
      colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
      Icon = Clock;
      label = 'Pending';
      break;
    case 'failed':
    case 'degraded':
      colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
      Icon = XCircle;
      label = 'Failed';
      break;
    case 'unknown':
      colorClass = 'bg-purple-50 text-purple-700 border-purple-200';
      Icon = AlertTriangle;
      label = 'Unknown';
      break;
    case 'replay_safe':
      colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      Icon = ShieldCheck;
      label = 'Replay Safe';
      break;
  }

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${colorClass} ${sizeClass}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span className="capitalize">{label}</span>
    </span>
  );
};
