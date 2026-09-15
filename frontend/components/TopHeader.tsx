'use client';

import React from 'react';
import { Search, Bell } from 'lucide-react';

interface TopHeaderProps {
  onOpenCommandPalette: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenCommandPalette }) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200/80 sticky top-0 z-20 px-6 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Search Bar Trigger */}
      <button
        onClick={onOpenCommandPalette}
        className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 text-xs w-72 transition-colors cursor-pointer text-left"
      >
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <span className="flex-1 truncate">Search users, withdrawals, instruments...</span>
        <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-500 shadow-xs">
          ⌘K
        </kbd>
      </button>

      {/* Header Actions */}
      <div className="flex items-center gap-4">
        {/* Environment Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Sandbox Mode</span>
        </div>

        {/* Notifications Icon */}
        <button
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
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
