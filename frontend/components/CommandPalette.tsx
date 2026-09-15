'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
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
  X,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMANDS = [
  { name: 'Overview Dashboard', href: '/overview', icon: LayoutDashboard, category: 'Navigation' },
  { name: 'Withdrawals List', href: '/withdrawals', icon: ArrowDownToLine, category: 'Navigation' },
  { name: 'Withdrawal Routing Simulator', href: '/withdrawals/simulate', icon: PlayCircle, category: 'Simulator' },
  { name: 'Users & Balances', href: '/users', icon: Users, category: 'Entities' },
  { name: 'Payment Instruments', href: '/payment-instruments', icon: CreditCard, category: 'Entities' },
  { name: 'Append-Only Ledger', href: '/ledger', icon: BookOpenCheck, category: 'Financials' },
  { name: 'Webhook Event Monitor', href: '/webhooks', icon: Webhook, category: 'Operations' },
  { name: 'Developer API Reference', href: '/developers', icon: Code2, category: 'Documentation' },
  { name: 'Audit Logs', href: '/audit-logs', icon: ScrollText, category: 'Operations' },
  { name: 'Settings & Environment', href: '/settings', icon: Settings, category: 'System' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Type a command or search (e.g., Simulator, Ledger)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-slate-900 placeholder:text-slate-400 text-sm"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              No matching pages or actions found for &quot;{query}&quot;
            </div>
          ) : (
            filteredCommands.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.href}
                  onClick={() => handleSelect(cmd.href)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-900 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-slate-800 group-hover:text-blue-900">{cmd.name}</span>
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-blue-600 font-normal">
                    {cmd.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Command Palette Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 shadow-xs font-mono text-[10px]">
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 shadow-xs font-mono text-[10px]">
                ↵
              </kbd>{' '}
              Select
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 shadow-xs font-mono text-[10px]">
              Esc
            </kbd>{' '}
            Close
          </span>
        </div>
      </div>
    </div>
  );
};
