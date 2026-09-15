'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PlayCircle,
  Code2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Layers,
} from 'lucide-react';
import { api, formatCurrency } from '@/lib/api';
import { RoutingDiagram } from '@/components/RoutingDiagram';
import { User, PaymentMethod, Deposit, CreateWithdrawalResponse } from '@/types';

export default function SimulatorPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserMethods, setSelectedUserMethods] = useState<PaymentMethod[]>([]);
  const [selectedUserDeposits, setSelectedUserDeposits] = useState<Deposit[]>([]);
  const [selectedPayoutMethodId, setSelectedPayoutMethodId] = useState<number | null>(null);

  const [amountRupees, setAmountRupees] = useState<string>('8000');
  const [currency] = useState<string>('INR');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `demo_sim_${Date.now()}`);
  const [mockOutcome, setMockOutcome] = useState<'submitted' | 'failed' | 'unknown'>('submitted');

  const [activeTab, setActiveTab] = useState<'simulation' | 'api'>('simulation');
  const [copied, setCopied] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [result, setResult] = useState<CreateWithdrawalResponse | null>(null);

  // 1. Fetch users on load
  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await api.getUsers();
        setUsers(data.users);
        if (data.users.length > 0) {
          // Default to Aarav Mehta for the canonical showcase
          const aarav = data.users.find((u) => u.email.includes('aarav')) || data.users[0];
          setSelectedUserId(aarav.id);
        }
      } catch (err: unknown) {
        setError({ code: 'load_error', message: (err as Error).message });
      }
    }
    loadUsers();
  }, []);

  // 2. When selected user changes, fetch their payment methods & deposits
  useEffect(() => {
    if (!selectedUserId) return;
    async function loadUserDetails() {
      try {
        const details = await api.getUser(selectedUserId!);
        setSelectedUserMethods(details.payment_methods);
        setSelectedUserDeposits(details.deposits);

        // Auto-select ACH/Bank default payout if available, else first method
        const defaultMethod =
          details.payment_methods.find((pm) => pm.asset_class === 'fiat_ach') ||
          details.payment_methods[0];
        if (defaultMethod) {
          setSelectedPayoutMethodId(defaultMethod.id);
        }
      } catch (err: unknown) {
        console.error('Failed to load user details', err);
      }
    }
    loadUserDetails();
  }, [selectedUserId]);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedPayoutMethodId) return;

    const parsedRupees = parseFloat(amountRupees);
    if (isNaN(parsedRupees) || parsedRupees <= 0) {
      setError({ code: 'invalid_amount', message: 'Amount must be a positive integer in rupees.' });
      return;
    }

    const amountCents = Math.round(parsedRupees * 100);

    try {
      setLoading(true);
      setError(null);

      const response = await api.createWithdrawal({
        user_id: selectedUserId,
        amount_cents: amountCents,
        default_payout_method_id: selectedPayoutMethodId,
        idempotency_key: idempotencyKey,
        mock_provider_outcome: mockOutcome,
      });

      setResult(response);
    } catch (err: unknown) {
      const apiErr = err as { code?: string; message?: string };
      setError({
        code: apiErr.code || 'execution_error',
        message: apiErr.message || 'An error occurred during withdrawal processing',
      });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const generateNewKey = () => {
    setIdempotencyKey(`demo_sim_${Date.now()}`);
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const requestJson = {
    user_id: selectedUserId,
    amount_cents: Math.round(parseFloat(amountRupees || '0') * 100),
    default_payout_method_id: selectedPayoutMethodId,
    idempotency_key: idempotencyKey,
    ...(mockOutcome !== 'submitted' ? { mock_provider_outcome: mockOutcome } : {}),
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            Interactive Orchestration Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Withdrawal Routing Simulator
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Test how withdrawals are routed back to original payment instruments using FIFO closed-loop logic,
            with real balance locking, idempotency, and append-only ledger entries.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center p-1 bg-slate-200/70 rounded-lg shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('simulation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'simulation'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" /> Simulation
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'api'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> API Request
          </button>
        </div>
      </div>

      {activeTab === 'simulation' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Column */}
          <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Configure Withdrawal</h2>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Live Service Input
              </span>
            </div>

            <form onSubmit={handleSimulate} className="space-y-4 text-xs">
              {/* Select User */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select User</label>
                <div className="relative">
                  <select
                    disabled={loading}
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                    className="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email} (Balance: {formatCurrency(u.balance_cents)})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'hidden'}`} />
                    {!loading && <ArrowRight className="w-3.5 h-3.5 rotate-90" />}
                  </div>
                </div>
                {selectedUser && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Available balance:{' '}
                    <span className="font-mono font-bold text-slate-700">
                      {formatCurrency(selectedUser.balance_cents)}
                    </span>
                  </p>
                )}
              </div>

              {/* Amount & Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Withdrawal Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      disabled={loading}
                      value={amountRupees}
                      onChange={(e) => setAmountRupees(e.target.value)}
                      placeholder="8000"
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 font-mono font-bold text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Canonical test: ₹8,000 across 3 FIFO cards + residual
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    disabled
                    value={currency}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-mono text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Default Payout Method */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Default Payout Method (Residual Excess)
                </label>
                <div className="relative">
                  <select
                    disabled={loading}
                    value={selectedPayoutMethodId || ''}
                    onChange={(e) => setSelectedPayoutMethodId(Number(e.target.value))}
                    className="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
                  >
                    {selectedUserMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.masked_token} ({pm.asset_class})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Receives any residual funds beyond refundable deposit principal.
                </p>
              </div>

              {/* Idempotency Key */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Idempotency Key</label>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={generateNewKey}
                    className="text-blue-600 hover:text-blue-800 text-[10px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Generate New
                  </button>
                </div>
                <input
                  type="text"
                  disabled={loading}
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Sandbox Mock Provider Outcome */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 text-[11px]">Provider Dispatch Simulation</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium">
                    Sandbox Control
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setMockOutcome('submitted')}
                    className={`py-1.5 px-2 rounded-md font-medium text-center text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                      mockOutcome === 'submitted'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Success
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setMockOutcome('failed')}
                    className={`py-1.5 px-2 rounded-md font-medium text-center text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                      mockOutcome === 'failed'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Failed
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setMockOutcome('unknown')}
                    className={`py-1.5 px-2 rounded-md font-medium text-center text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                      mockOutcome === 'unknown'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Unknown
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  {mockOutcome === 'submitted' && 'Standard flow: Legs dispatched and marked submitted.'}
                  {mockOutcome === 'failed' && 'Tests compensating reversal: Leg fails, +reversal credit posted to restore balance.'}
                  {mockOutcome === 'unknown' && 'Tests non-terminal invariant: No automatic reversal, awaits async webhook.'}
                </p>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Processing Closed-Loop Route...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" /> Simulate Withdrawal
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Error Banner */}
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>Domain Engine Refusal: {error.code}</span>
                </div>
                <p className="text-slate-700 pl-6">{error.message}</p>
                <div className="pl-6 pt-1 text-[11px] text-slate-500 font-mono">
                  HTTP status returned by WithdrawalService. Request was not processed into fake success.
                </div>
              </div>
            )}

            {/* Success Result Container */}
            {result ? (
              <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-2xs space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Valid Routing Result</h2>
                      <p className="text-[11px] text-slate-400">Withdrawal #{result.withdrawal_id} orchestrated</p>
                    </div>
                  </div>
                  <Link
                    href={`/withdrawals/${result.withdrawal_id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    View Details <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Badges bar */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Deterministic FIFO
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium">
                    <Layers className="w-3.5 h-3.5 text-blue-600" /> Append-Only Ledger
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Replay-Safe Idempotency
                  </span>
                </div>

                {/* Routing Flow Diagram */}
                <RoutingDiagram
                  originalDeposits={selectedUserDeposits}
                  legs={result.legs}
                  totalAmountCents={result.legs.reduce((acc, l) => acc + l.amount_cents, 0)}
                />

                {/* Quick Summary of Legs */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                  <span className="font-semibold text-slate-700 block">Leg Breakdown:</span>
                  <div className="divide-y divide-slate-200">
                    {result.legs.map((leg, idx) => (
                      <div key={leg.id || idx} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-medium text-slate-900">
                            Leg #{leg.id || idx + 1}:
                          </span>{' '}
                          <span className="text-slate-600">{leg.payment_method_label}</span>
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                            {leg.leg_type === 'refund' ? 'Closed-Loop Refund' : 'Default Residual'}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-slate-900">
                          {formatCurrency(leg.amount_cents)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Idle state placeholder */
              <div className="bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                  <PlayCircle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Ready to Simulate</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Configure the withdrawal amount and default payout method on the left, then click{' '}
                  <span className="font-semibold text-slate-700">&quot;Simulate Withdrawal&quot;</span> to trigger the
                  authoritative closed-loop routing logic.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* API Request Mode */
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">API Request Inspector</h2>
              <p className="text-xs text-slate-400">Direct HTTP payload sent to POST /api/withdrawals</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(JSON.stringify(requestJson, null, 2))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Request'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="px-2 py-1 rounded bg-blue-600 text-white font-bold">POST</span>
              <span className="text-slate-800 font-semibold">/api/withdrawals</span>
            </div>

            {/* Request Headers Display */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs font-mono">
              <div className="text-[10px] uppercase font-bold text-slate-400">Request Headers:</div>
              <div className="text-slate-600"><span className="text-slate-900 font-semibold">Content-Type:</span> application/json</div>
              <div className="text-slate-600"><span className="text-slate-900 font-semibold">Accept:</span> application/json</div>
              <div className="text-slate-600"><span className="text-slate-900 font-semibold">X-Idempotency-Key:</span> {idempotencyKey}</div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Request Body:</div>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto">
                {JSON.stringify(requestJson, null, 2)}
              </pre>
            </div>
          </div>

          {result && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2 py-1 rounded bg-emerald-600 text-white font-bold">201 CREATED</span>
                  <span className="text-slate-600">Response Payload</span>
                </div>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Response'}
                </button>
              </div>
              <pre className="p-4 bg-slate-900 text-emerald-400 rounded-lg font-mono text-xs overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
