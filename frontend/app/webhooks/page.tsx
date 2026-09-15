'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw, Send } from 'lucide-react';
import { api, formatDateTime } from '@/lib/api';
import { WebhookEventRecord } from '@/types';

export default function WebhooksPage() {
  const [events, setEvents] = useState<WebhookEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEventRecord | null>(null);

  // Manual webhook trigger state
  const [mockExternalId, setMockExternalId] = useState('ext_demo_manual_1');
  const [mockStatus, setMockStatus] = useState('settled');
  const [triggering, setTriggering] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const data = await api.getWebhooks();
      setEvents(data.webhooks);
      if (data.webhooks.length > 0) {
        setSelectedEvent((prev) => prev || data.webhooks[0]);
      }
    } catch (err) {
      console.error('Failed to load webhooks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    api.getWebhooks()
      .then((data) => {
        if (!isMounted) return;
        setEvents(data.webhooks);
        if (data.webhooks.length > 0) {
          setSelectedEvent((prev) => prev || data.webhooks[0]);
        }
      })
      .catch((err) => console.error('Failed to load webhooks', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleTriggerWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTriggering(true);
      setTriggerFeedback(null);
      const res = await api.postWebhook({
        external_event_id: `evt_manual_${Date.now()}`,
        event_type: `payout.${mockStatus}`,
        payload: {
          external_id: mockExternalId,
          status: mockStatus,
        },
      });
      setTriggerFeedback(`Webhook processed successfully (${res.status})`);
      fetchWebhooks();
    } catch (err: unknown) {
      setTriggerFeedback(`Webhook failed: ${(err as Error).message}`);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Inbound Telemetry
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Webhook Event Monitor
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Inspect incoming provider callbacks, settlement webhooks, and idempotent replay-safe processing.
          </p>
        </div>

        <button
          onClick={fetchWebhooks}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto"
          title="Refresh Events"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Table: Event Inbox (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Event Inbox</h2>
            <span className="text-xs text-slate-400">{events.length} Received Events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-400 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 font-semibold">Event ID</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Replay Safe</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      Loading webhooks...
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      No webhook callbacks logged yet.
                    </td>
                  </tr>
                ) : (
                  events.map((evt) => (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`cursor-pointer transition-colors ${
                        selectedEvent?.id === evt.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-medium text-slate-900">
                        {evt.external_event_id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {evt.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <ShieldCheck className="w-3 h-3" /> Replay Safe
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-right whitespace-nowrap">
                        {formatDateTime(evt.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Event Detail & Manual Test (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selected Event Payload */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Event Payload Inspector</h2>
              {selectedEvent && (
                <span className="text-[10px] font-mono text-slate-400">
                  ID: {selectedEvent.external_event_id}
                </span>
              )}
            </div>

            {selectedEvent ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Processed Status:</span>
                  <span className="font-semibold text-emerald-700">
                    {selectedEvent.processed_at ? 'Processed & Deduplicated' : 'Pending Processing'}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Raw JSON Body
                  </span>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto max-h-56">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">
                Select an event on the left to inspect its payload.
              </p>
            )}
          </div>

          {/* Test Webhook Callback Simulator */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Test Webhook Ingestion
                </h3>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                Sandbox Tool
              </span>
            </div>

            <form onSubmit={handleTriggerWebhook} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target External ID</label>
                <input
                  type="text"
                  value={mockExternalId}
                  onChange={(e) => setMockExternalId(e.target.value)}
                  placeholder="ext_..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Callback Status</label>
                <select
                  value={mockStatus}
                  onChange={(e) => setMockStatus(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="settled">Settled (payout.settled)</option>
                  <option value="failed">Failed (payout.failed)</option>
                  <option value="submitted">Submitted (payout.submitted)</option>
                </select>
              </div>

              {triggerFeedback && (
                <p className="text-[11px] font-medium text-blue-600">{triggerFeedback}</p>
              )}

              <button
                type="submit"
                disabled={triggering}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> Send Test Webhook
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
