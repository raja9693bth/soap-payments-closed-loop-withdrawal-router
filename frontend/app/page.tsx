import React from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  Lock,
  RefreshCw,
  BookOpenCheck,
  Zap,
  PlayCircle,
  CheckCircle2,
  Server,
  Database,
  Code2,
} from 'lucide-react';

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      clipRule="evenodd"
    />
  </svg>
);

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://soap-payments.vercel.app').replace(/\/$/, '');

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'SOAP Payments | Closed-Loop Withdrawal Router & Fintech Engine',
  description:
    'Enterprise-grade closed-loop payments orchestration platform. Enforces FIFO refund routing, pessimistic concurrency control, append-only double-entry ledgering, and webhook reconciliation.',
  openGraph: {
    title: 'SOAP Payments — Closed-Loop Withdrawal Router',
    description:
      'Enterprise fintech operations platform: FIFO closed-loop refund routing, pessimistic row locking, and immutable append-only ledger.',
    url: siteUrl,
    siteName: 'SOAP Payments',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SOAP Payments — Closed-Loop Withdrawal Router',
    description:
      'Enterprise fintech operations platform: FIFO closed-loop refund routing, pessimistic row locking, and immutable append-only ledger.',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold group-hover:bg-blue-500 transition-colors">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-[15px]">
                SOAP Payments
              </span>
              <span className="ml-1.5 text-[10px] font-semibold uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                Core Router
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium">
            <Link
              href="/withdrawals/simulate"
              className="text-slate-600 hover:text-slate-900 transition-colors hidden sm:block"
            >
              Simulator
            </Link>
            <Link
              href="/developers"
              className="text-slate-600 hover:text-slate-900 transition-colors hidden sm:block"
            >
              API Specs
            </Link>
            <a
              href="https://github.com/raja9693bth/soap-payments-closed-loop-withdrawal-router"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors"
              aria-label="GitHub repository"
            >
              <GithubIcon className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <Link
              href="/overview"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-colors"
            >
              <span>Launch Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-16 sm:py-24 px-4 sm:px-8 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 mb-6 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            Anti-Money Laundering (AML) Compliance &amp; Payout Orchestration
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15] max-w-4xl mx-auto">
            Closed-Loop Withdrawal Routing for Modern Fintechs
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Automatically refund originating deposit payment methods in FIFO sequence before
            routing residual balances to customer payout accounts. Powered by pessimistic row locking
            and append-only double-entry ledger reconciliation.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/overview"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all hover:shadow-md"
            >
              <span>Open Operations Console</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/withdrawals/simulate"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-200 shadow-2xs transition-all"
            >
              <PlayCircle className="w-4 h-4 text-blue-600" />
              <span>Simulate Withdrawal</span>
            </Link>
          </div>

          {/* Sandbox Indicator */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Interactive Portfolio Sandbox with Pre-Seeded Indian Rupee (INR) Accounts</span>
          </div>
        </section>

        {/* Problem & Invariant Guarantee Highlights */}
        <section className="py-12 bg-white border-y border-slate-200/80 px-4 sm:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600">
                Regulatory Architecture
              </h2>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                The Closed-Loop Routing Problem
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2">
                Card brand rules (Visa/Mastercard) and AML directives require withdrawals to return
                funds to the exact instruments used for deposits before allowing general bank payouts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900">FIFO Refund Allocation</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Historical deposits are tracked with unrefunded principal amounts. Payouts first refund
                  the oldest settled deposits chronologically until principal is exhausted.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Asset Family Isolation</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Withdrawals cannot cross asset boundaries. Fiat card and ACH deposits cannot be
                  discharged through crypto wallets, eliminating cross-asset leakage risks.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <BookOpenCheck className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Append-Only Ledger</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Zero destructive updates. Every deposit, debit, and compensating reversal writes an
                  immutable signed transaction where user balance equals the sum of ledger entries.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Architecture & Stack */}
        <section className="py-16 px-4 sm:px-8 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600">
              System Engineering
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Production-Grade Architecture
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Separation of concerns between edge presentation, lightweight API controllers, and
              the authoritative Ruby domain engine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <Zap className="w-4 h-4" /> Next.js 15 Console
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                App Router, TypeScript, Tailwind CSS, responsive drawer navigation, and real-time simulator.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
                <Server className="w-4 h-4" /> Sinatra REST API
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Rack-based REST adapter with rate limiting, host authorization, CORS controls, and error envelopes.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <Code2 className="w-4 h-4" /> Domain Engine
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Authoritative WithdrawalService, ClosedLoopResolver, PayoutDispatcher, and WebhookHandler.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <Database className="w-4 h-4" /> PostgreSQL Ledger
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pessimistic row locking (<code>FOR UPDATE</code>), SHA-256 idempotency store, and double-entry ledger.
              </p>
            </div>
          </div>

          {/* Guarantees Checklist */}
          <div className="mt-10 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-600" />
              Verified Financial &amp; Concurrency Guarantees
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pessimistic balance row locking</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>SHA-256 database idempotency store</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>409 Conflict on payload tampering</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Compensating ledger reversal on failure</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Replay-safe webhook deduplication</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero balance drift / exact reconciliation</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-4 sm:px-8 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              S
            </div>
            <span className="font-semibold text-slate-800">SOAP Payments</span>
            <span>&bull;</span>
            <span>Closed-Loop Withdrawal Router Portfolio Project</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/overview" className="hover:text-slate-900 transition-colors">
              Console
            </Link>
            <Link href="/withdrawals/simulate" className="hover:text-slate-900 transition-colors">
              Simulator
            </Link>
            <Link href="/developers" className="hover:text-slate-900 transition-colors">
              API
            </Link>
            <a
              href="https://github.com/raja9693bth/soap-payments-closed-loop-withdrawal-router"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
