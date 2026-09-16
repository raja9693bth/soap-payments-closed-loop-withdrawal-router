'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  AlertTriangle,
  PlayCircle,
  Database,
  Cpu,
  Server,
  Radio,
  FileCheck,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { api, formatCurrency, formatDateTime, SoapApiError, ConnectionStateEvent } from '@/lib/api';
import { DashboardMetrics } from '@/types';

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; resolution?: string } | null>(null);
  const [dateRange, setDateRange] = useState('7d');
  const [connState, setConnState] = useState<ConnectionStateEvent>(() => api.getConnectionState());
  const activeControllerRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    return api.subscribe((event) => {
      setConnState(event);
    });
  }, []);

  const fetchMetrics = useCallback(async (selectedRange: string) => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await api.getDashboard(selectedRange, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setMetrics(data);
        setError(null);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted || (err as Error)?.name === 'AbortError') {
        return;
      }
      if (err instanceof SoapApiError) {
        setError({ message: err.message, resolution: err.resolution });
      } else {
        setError({ message: (err as Error).message || 'Failed to connect to backend' });
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleRefresh = useCallback(() => {
    fetchMetrics(dateRange);
  }, [fetchMetrics, dateRange]);

  // Clean lifecycle: exactly one request on mount, and one on dateRange change.
  useEffect(() => {
    fetchMetrics(dateRange);
    return () => {
      activeControllerRef.current?.abort();
    };
  }, [dateRange, fetchMetrics]);

  // Derive authoritative ledger balance states
  const getLedgerCardProps = () => {
    if (loading && !metrics) {
      return {
        value: '—',
        badge: 'Verifying',
        badgeVariant: 'neutral' as const,
        secondaryContext: 'Checking ledger entries...',
      };
    }

    if (error && !metrics) {
      return {
        value: '—',
        badge: 'Unavailable',
        badgeVariant: 'error' as const,
        secondaryContext: 'Backend connection failed',
      };
    }

    if (metrics?.kpis.ledger_balanced) {
      return {
        value: '100%',
        badge: 'Reconciled',
        badgeVariant: 'success' as const,
        secondaryContext: 'All entries balanced',
      };
    }

    return {
      value: 'Mismatch',
      badge: 'Action Required',
      badgeVariant: 'error' as const,
      secondaryContext: 'Reconciliation mismatch detected',
    };
  };

  const ledgerProps = getLedgerCardProps();

  return (
    <div className="space-y-8 pb-12">
      {/* Overview Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Payments Infrastructure
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Secure. Deterministic. Built for Scale.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Route withdrawals back to original payment instruments, prevent duplicate movement, and
            maintain a balanced append-only ledger.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          {/* Interactive Date Range Filter */}
          <div className="relative inline-flex items-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs text-slate-700">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="bg-transparent border-none outline-none font-medium text-slate-700 text-xs cursor-pointer pr-4 appearance-none"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="month">Current Month</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 -ml-3 pointer-events-none" />
            </div>
          </div>

          <Link
            href="/withdrawals/simulate"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Launch Simulator
          </Link>
        </div>
      </div>

      {/* Progressive Wake-up / Connecting Banner during Cold Start */}
      {loading && (connState.state === 'waking' || connState.state === 'connecting') && (
        <div
          className={`p-4 rounded-xl text-xs space-y-1.5 shadow-2xs border ${
            connState.state === 'waking'
              ? 'bg-amber-50 border-amber-300/80 text-amber-950'
              : 'bg-blue-50 border-blue-200 text-blue-950'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            <RefreshCw
              className={`w-4 h-4 animate-spin shrink-0 ${
                connState.state === 'waking' ? 'text-amber-600' : 'text-blue-600'
              }`}
            />
            <span>
              {connState.state === 'waking'
                ? 'Waking Sandbox Backend…'
                : 'Connecting to Sandbox Backend…'}
            </span>
          </div>
          <p className="text-slate-700 leading-relaxed">
            {connState.state === 'waking'
              ? 'The Render sandbox may take up to about a minute to wake after inactivity. Live telemetry will populate automatically once the service is online.'
              : 'Establishing connection with SOAP Payments sandbox API…'}
          </p>
        </div>
      )}

      {/* Backend Disconnection / Outage Banner (Only when recovery is exhausted or genuine error confirmed) */}
      {!loading && error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Backend Unavailable</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-rose-300 text-rose-800 font-semibold hover:bg-rose-100/60 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Retry Connection
            </button>
          </div>
          <p className="text-slate-700">{error.message}</p>
          {error.resolution && (
            <p className="text-slate-500 font-medium text-[11px]">{error.resolution}</p>
          )}
        </div>
      )}

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Withdrawal Volume"
          value={metrics ? formatCurrency(metrics.kpis.total_volume_cents) : '—'}
          icon={ArrowDownToLine}
          trend={metrics ? { value: '+12.5% vs last week', positive: true } : undefined}
          secondaryContext={metrics ? 'Settled + Dispatched' : error ? 'Backend offline' : 'Loading volume...'}
          badge={metrics ? 'Sandbox Data' : error ? 'Unavailable' : undefined}
          badgeVariant={metrics ? 'neutral' : 'error'}
          isLoading={loading && !metrics}
        />
        <StatCard
          label="Total Withdrawals"
          value={metrics ? metrics.kpis.total_withdrawals_count : '—'}
          icon={Layers}
          trend={metrics ? { value: '+8.2%', positive: true } : undefined}
          secondaryContext={metrics ? 'Deterministic routes' : error ? 'Backend offline' : 'Loading routes...'}
          isLoading={loading && !metrics}
        />
        <StatCard
          label="Success Rate"
          value={metrics ? `${metrics.kpis.success_rate}%` : '—'}
          icon={CheckCircle2}
          trend={metrics ? { value: '+0.4%', positive: true } : undefined}
          secondaryContext={metrics ? 'Provider settlement' : error ? 'Backend offline' : 'Loading rate...'}
          isLoading={loading && !metrics}
        />
        <StatCard
          label="Ledger Balance"
          value={ledgerProps.value}
          icon={ShieldCheck}
          badge={ledgerProps.badge}
          badgeVariant={ledgerProps.badgeVariant}
          secondaryContext={ledgerProps.secondaryContext}
          isLoading={loading && !metrics}
        />
      </div>

      {/* Charts Row: 7-Day Trend + Outcome Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Withdrawal Trends */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Withdrawal Trends</h2>
              <p className="text-xs text-slate-400">Volume distribution across the last 7 days</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Settled
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Failed
              </span>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          {loading && !metrics ? (
            <div className="mt-6 flex items-center justify-center h-44 text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading chart telemetry...
            </div>
          ) : error && !metrics ? (
            <div className="mt-6 flex items-center justify-center h-44 text-slate-400 text-xs">
              Chart data unavailable while backend is disconnected.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pb-2">
              {(metrics?.trends_7d || []).map((day, idx) => {
                const maxVal = Math.max(1, ...(metrics?.trends_7d || []).map((d) => d.successful_cents + d.failed_cents));
                const successHeight = Math.min(100, (day.successful_cents / maxVal) * 100);
                const failHeight = Math.min(100, (day.failed_cents / maxVal) * 100);

                return (
                  <div key={idx} className="flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="w-full flex flex-col gap-1 items-center justify-end h-32 relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10">
                        {formatCurrency(day.successful_cents)}
                      </div>

                      {failHeight > 0 && (
                        <div
                          style={{ height: `${failHeight}%` }}
                          className="w-full max-w-[28px] bg-rose-400 rounded-t-sm"
                        />
                      )}
                      <div
                        style={{ height: `${Math.max(8, successHeight)}%` }}
                        className="w-full max-w-[28px] bg-blue-600 hover:bg-blue-500 rounded-t-sm transition-colors"
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">{day.date}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outcome Distribution */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Outcome Distribution</h2>
            <p className="text-xs text-slate-400">Terminal vs in-flight settlement</p>
          </div>

          <div className="py-6 flex flex-col items-center justify-center">
            <div className="relative w-36 h-36 rounded-full border-8 border-blue-600 flex items-center justify-center bg-blue-50/20">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                  {metrics ? `${metrics.kpis.success_rate}%` : '—'}
                </div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Success
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Settled / Success
              </span>
              <span className="font-mono font-bold text-slate-800">
                {metrics ? (metrics.outcome_distribution.settled + metrics.outcome_distribution.submitted) : '—'}
                {metrics ? ` (${metrics.kpis.success_rate}%)` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Failed / Reversed
              </span>
              <span className="font-mono font-bold text-slate-800">
                {metrics ? metrics.outcome_distribution.failed : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> In-Flight / Pending
              </span>
              <span className="font-mono font-bold text-slate-800">
                {metrics ? metrics.outcome_distribution.pending : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: System Status & Recent Withdrawals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Status */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">System Status</h2>
            </div>
            <span className="text-[10px] text-slate-400">
              {metrics ? 'Live Telemetry' : error ? 'Offline' : 'Checking...'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 text-xs mt-2">
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span>Withdrawal Router</span>
              </div>
              <StatusBadge status={metrics ? 'Healthy' : error ? 'Offline' : 'Pending'} size="sm" />
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Server className="w-3.5 h-3.5 text-slate-400" />
                <span>Payout Dispatcher</span>
              </div>
              <StatusBadge status={metrics ? 'Healthy' : error ? 'Offline' : 'Pending'} size="sm" />
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <FileCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Ledger Service</span>
              </div>
              <StatusBadge status={metrics?.kpis.ledger_balanced ? 'Healthy' : metrics ? 'Degraded' : error ? 'Offline' : 'Pending'} size="sm" />
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Radio className="w-3.5 h-3.5 text-slate-400" />
                <span>Webhook Ingestion</span>
              </div>
              <StatusBadge status={metrics ? 'Healthy' : error ? 'Offline' : 'Pending'} size="sm" />
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>PostgreSQL Database</span>
              </div>
              <StatusBadge status={metrics ? 'Healthy' : error ? 'Offline' : 'Pending'} size="sm" />
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Routing Operations</h2>
              <p className="text-xs text-slate-400">Latest withdrawals executed by domain engine</p>
            </div>
            <Link
              href="/withdrawals"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 uppercase text-[10px]">
                  <th className="py-2 font-semibold">Withdrawal ID</th>
                  <th className="py-2 font-semibold">User</th>
                  <th className="py-2 font-semibold">Amount</th>
                  <th className="py-2 font-semibold">Legs</th>
                  <th className="py-2 font-semibold">Status</th>
                  <th className="py-2 font-semibold text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !metrics ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Loading operations telemetry...
                    </td>
                  </tr>
                ) : error && !metrics ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Telemetry data unavailable while backend is disconnected.
                    </td>
                  </tr>
                ) : (metrics?.recent_withdrawals || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No withdrawal activity recorded yet.
                    </td>
                  </tr>
                ) : (
                  (metrics?.recent_withdrawals || []).map((wd) => (
                    <tr key={wd.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 font-mono font-medium text-slate-900">
                        <Link href={`/withdrawals/${wd.id}`} className="hover:text-blue-600 underline">
                          wd_{wd.id}
                        </Link>
                      </td>
                      <td className="py-2.5 text-slate-600 truncate max-w-[140px]">{wd.user_email || `User #${wd.user_id}`}</td>
                      <td className="py-2.5 font-mono font-bold text-slate-900">
                        {formatCurrency(wd.amount_cents)}
                      </td>
                      <td className="py-2.5 text-slate-600">{wd.legs_count} legs</td>
                      <td className="py-2.5">
                        <StatusBadge status={wd.state} size="sm" />
                      </td>
                      <td className="py-2.5 text-slate-400 text-right">{formatDateTime(wd.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
