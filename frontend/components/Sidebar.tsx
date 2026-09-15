'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowDownToLine,
  PlayCircle,
  Users,
  CreditCard,
  BookOpenCheck,
  Webhook,
  Code2,
  ScrollText,
  Settings,
  ShieldCheck,
  Layers,
  ChevronRight,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', href: '/overview', icon: LayoutDashboard },
  { name: 'Withdrawals', href: '/withdrawals', icon: ArrowDownToLine },
  { name: 'Simulator', href: '/withdrawals/simulate', icon: PlayCircle, highlight: true },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Payment Instruments', href: '/payment-instruments', icon: CreditCard },
  { name: 'Ledger', href: '/ledger', icon: BookOpenCheck },
  { name: 'Webhooks', href: '/webhooks', icon: Webhook },
  { name: 'Developers', href: '/developers', icon: Code2 },
  { name: 'Activity Logs', href: '/audit-logs', icon: ScrollText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isDrawer?: boolean;
  onClose?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isDrawer = false, onClose, className = '' }) => {
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (isDrawer && onClose) {
      onClose();
    }
  };

  const containerClasses = isDrawer
    ? `w-72 max-w-[85vw] bg-slate-900 text-slate-200 flex flex-col h-full select-none ${className}`
    : `hidden lg:flex w-64 bg-slate-900 text-slate-200 flex-col h-screen fixed left-0 top-0 z-30 border-r border-slate-800 select-none ${className}`;

  return (
    <aside className={containerClasses}>
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
        <Link href="/overview" onClick={handleLinkClick} className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold tracking-wider group-hover:bg-blue-500 transition-colors">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white tracking-tight text-[15px] flex items-center gap-2">
              SOAP Payments
              <span className="text-[10px] font-semibold uppercase bg-blue-900/60 text-blue-300 px-1.5 py-0.5 rounded border border-blue-700/50">
                Core
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Closed-Loop. Safer Payments.
            </div>
          </div>
        </Link>

        {/* Drawer close button (X) */}
        {isDrawer && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer -mr-2"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Operations
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/overview' && pathname.startsWith(item.href) && item.href !== '/withdrawals');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={handleLinkClick}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : item.highlight
                  ? 'text-blue-300 hover:bg-slate-800/80 hover:text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-white' : item.highlight ? 'text-blue-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.name}</span>
              </div>
              {item.highlight && !isActive && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-1.5 py-0.5 rounded border border-blue-400/30">
                  Live
                </span>
              )}
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-xs space-y-2.5">
        <div className="flex items-center justify-between px-2 text-[11px]">
          <span className="text-slate-400">Environment</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Sandbox
          </span>
        </div>

        <div className="flex items-center justify-between px-2 text-[11px]">
          <span className="text-slate-400">Router Core</span>
          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
            <ShieldCheck className="w-3 h-3" /> Operational
          </span>
        </div>

        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-300">
              R
            </div>
            <div>
              <div className="text-[12px] font-medium text-slate-200 leading-tight">Raja</div>
              <div className="text-[10px] text-slate-400">Developer</div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-500">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
