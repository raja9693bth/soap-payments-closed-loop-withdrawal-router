'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Menu } from 'lucide-react';
import { api, ConnectionStateEvent } from '@/lib/api';

interface TopHeaderProps {
  onOpenCommandPalette: () => void;
  onOpenMobileNav: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onOpenCommandPalette,
  onOpenMobileNav,
}) => {
  const router = useRouter();
  const [connState, setConnState] = useState<ConnectionStateEvent>(() => api.getConnectionState());

  useEffect(() => {
    return api.subscribe((event) => {
      setConnState(event);
    });
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200/80 sticky top-0 z-20 px-3 sm:px-6 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Left side: Hamburger (mobile/tablet) + Search */}
      <div className="flex items-center gap-2">
        {/* Accessible Mobile Drawer Trigger */}
        <button
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Compact Search Trigger on Small Screens (<640px) */}
        <button
          onClick={onOpenCommandPalette}
          aria-label="Search"
          className="sm:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Desktop & Tablet Search Bar Trigger (>=640px) */}
        <button
          onClick={onOpenCommandPalette}
          aria-label="Search users, withdrawals, instruments"
          className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 text-xs w-52 md:w-72 transition-colors cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="flex-1 truncate">Search users, withdrawals, instruments...</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500 shadow-xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Dynamic Sandbox Connection & Wake-up Badge */}
        {connState.state === 'waking' && (
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="hidden sm:inline">Waking Sandbox…</span>
            <span className="sm:hidden">Waking…</span>
          </div>
        )}
        {connState.state === 'connecting' && (
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="hidden sm:inline">Connecting…</span>
            <span className="sm:hidden">Connecting</span>
          </div>
        )}
        {connState.state === 'connected' && (
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="hidden sm:inline">Sandbox Connected</span>
            <span className="sm:hidden">Sandbox</span>
          </div>
        )}
        {connState.state === 'unavailable' && (
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span className="hidden sm:inline">Sandbox Offline</span>
            <span className="sm:hidden">Offline</span>
          </div>
        )}

        {/* Notifications Icon */}
        <button
          onClick={() => router.push('/audit-logs')}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          title="View Activity Logs & System Notifications"
          aria-label="View Activity Logs & System Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        {/* User Identity (avatar only on mobile) */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
            R
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-medium text-slate-800 leading-tight">Raja</div>
            <div className="text-[10px] text-slate-400">Engineering</div>
          </div>
        </div>
      </div>
    </header>
  );
};
