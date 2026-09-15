'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Info } from 'lucide-react';
import { api, formatDateTime } from '@/lib/api';
import { AuditLogEvent } from '@/types';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAuditLogs();
      setLogs(data.activity_logs || data.audit_logs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load activity logs';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const data = await api.getAuditLogs();
        if (isMounted) setLogs(data.activity_logs || data.audit_logs);
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load activity logs';
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Operations &amp; Telemetry
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Activity Log / Derived Operations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Synthesized operational feed of withdrawal state transitions, ledger debits, and
            webhook callbacks derived from PostgreSQL records.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Derived Telemetry
          </span>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            title="Refresh Activity Logs"
            aria-label="Refresh Activity Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Honest Scope Banner */}
      <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 flex items-start gap-3 text-xs text-slate-700">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-900">Derived Operations Note: </span>
          For portfolio demonstration purposes, this stream synthesizes activity events from
          underlying immutable ledger entries, withdrawal lifecycle timestamps, and recorded webhook
          deliveries rather than maintaining a separate append-only audit event store.
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Unable to load activity logs</span>
            </div>
            <button
              onClick={fetchLogs}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-rose-300 text-rose-800 font-semibold hover:bg-rose-100/60 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
          <p className="text-slate-700">{error}</p>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-400 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Timestamp</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Actor / Caller</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Action</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Target Resource</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Result</th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Request ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading activity trail...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Activity logs currently unavailable.
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No operational activity events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {log.actor}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-blue-600 font-semibold whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap font-medium">
                      {log.resource}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          ['settled', 'success', 'ok'].includes((log.result || '').toLowerCase())
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ['failed', 'error'].includes((log.result || '').toLowerCase())
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-right whitespace-nowrap">
                      {log.request_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
