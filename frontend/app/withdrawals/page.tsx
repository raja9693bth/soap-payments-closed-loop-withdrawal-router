'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, formatCurrency, formatDateTime } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';
import { Withdrawal, PaginationMeta } from '@/types';

export default function WithdrawalsListPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getWithdrawals({
        status: statusFilter || undefined,
        q: search.trim() || undefined,
        page: page,
        page_size: 15,
      });
      setWithdrawals(data.withdrawals || []);
      setPagination(data.pagination || null);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load withdrawals from backend');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  const handleRefresh = useCallback(() => {
    setError(null);
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWithdrawals();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Payment Operations
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Withdrawals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Monitor withdrawal lifecycle, closed-loop routing, and provider settlement state.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            title="Refresh List"
            aria-label="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/withdrawals/simulate"
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4" />
            New Simulation
          </Link>
        </div>
      </div>

      {/* Backend Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Backend Error: Unable to fetch withdrawals</span>
            </div>
            <button
              onClick={handleRefresh}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-rose-300 text-rose-800 font-semibold hover:bg-rose-100/60 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
          <p className="text-slate-700">{error}</p>
        </div>
      )}

      {/* Filter and Server-Side Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs"
      >
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Search by ID or user email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400"
            aria-label="Search withdrawals"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="relative w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-auto pl-3 pr-8 py-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer"
              aria-label="Filter by withdrawal status"
            >
              <option value="">All Statuses</option>
              <option value="settled">Settled</option>
              <option value="submitted">Submitted</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {(search || statusFilter) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline ml-2 whitespace-nowrap cursor-pointer min-h-[36px] flex items-center"
            >
              Reset Filters
            </button>
          )}
        </div>
      </form>

      {/* Withdrawals Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Withdrawal ID</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">User</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Amount</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Routing Legs</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Idempotency Key</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Created At</th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading withdrawals...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Unable to display withdrawals due to backend connection failure.
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 space-y-2">
                    <div>No withdrawals match the current criteria.</div>
                    {(search || statusFilter) && (
                      <button
                        onClick={handleResetFilters}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        Reset active filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      wd_{w.id}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {w.user_email || `User #${w.user_id}`}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(w.amount_cents)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                        {w.legs_count} {w.legs_count === 1 ? 'leg' : 'legs'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={w.state} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {w.idempotency_key_masked || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {formatDateTime(w.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/withdrawals/${w.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 min-h-[36px] items-center"
                      >
                        Details <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.total_pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{withdrawals.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{pagination.total_count}</span>{' '}
              withdrawals (Page {pagination.page} of {pagination.total_pages})
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="px-2 font-semibold text-slate-700">
                {page} / {pagination.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                disabled={page >= pagination.total_pages || loading}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                aria-label="Next page"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
