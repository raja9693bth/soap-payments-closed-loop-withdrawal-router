# Soap Payments — Closed-Loop Withdrawal Router

A Ruby on Rails payment orchestration service designed to process user withdrawals with deterministic Anti-Money Laundering (AML) closed-loop routing, pessimistic concurrency control, database-backed idempotency, append-only double-entry ledgering, and replay-safe asynchronous settlement.

---

## Overview & Domain Problem

In financial payment platforms, handling fund withdrawals requires strict adherence to compliance rules and financial invariants:
1. **AML Closed-Loop Compliance:** Payouts must first refund prior deposits back to their originating payment instruments in FIFO order (by settlement timestamp) before any residual excess is routed to a default payout method.
2. **Asset Family Isolation:** Crossing asset classes (e.g., fiat card/ACH vs. cryptocurrency) is explicitly refused to prevent unauthorized currency conversions or routing anomalies.
3. **Double-Spend & Overdraft Prevention:** Concurrent withdrawal requests must serialize on the user's balance row to ensure a user can never withdraw more than their available balance.
4. **Idempotency & Replay Safety:** Retried API calls with the same key and payload return identical cached responses without duplicate financial side effects, while mismatched payloads trigger a `409 Conflict`.
5. **Reconciliation & Ledger Integrity:** All money movement is recorded as signed deltas in an append-only, immutable ledger where `opening_balance + sum(ledger_deltas) == current_balance`.
6. **Ambiguous Settlement:** Network timeouts and provider `:unknown` responses remain non-terminal without premature reversal or automatic duplicate retries. Definite failures trigger an exact-once compensating ledger reversal.

---

## Architectural Components

The solution is structured as a modular service layer built on ActiveRecord and PostgreSQL:

```
app/
├── models/
│   ├── deposit.rb               # Tracks unrefunded_principal_cents and settled_at
│   ├── idempotency_key.rb       # Stores SHA-256 request fingerprints and cached responses
│   ├── ledger_entry.rb          # Immutable, append-only audit trail (update/delete blocked)
│   ├── payment_method.rb        # Tokenized instruments with asset_class (fiat_card, fiat_ach, crypto)
│   ├── payout_leg.rb            # Individual legs comprising a withdrawal (pending, submitted, settled, failed)
│   ├── user.rb                  # Balance owner with balance_cents
│   ├── webhook_event.rb         # Asynchronous provider callbacks deduplicated by external_event_id
│   └── withdrawal.rb            # Aggregate withdrawal entity
└── services/
    ├── withdrawal_service.rb          # Main entry point: validation, locking, transactions, idempotency
    ├── closed_loop_resolver.rb        # Deterministic FIFO allocation and asset-family validation
    ├── payout_dispatcher.rb           # Decoupled provider dispatch and synchronous failure compensation
    ├── withdrawal_webhook_handler.rb  # Replay-safe async settlement and late failure protection
    └── mock_payout_provider.rb        # Simulated provider interface
```

---

## Key Invariants & Design Decisions

### 1. Orchestration & Concurrency (`WithdrawalService`)
- Validates user instance, integer cents (`amount_cents > 0`), non-empty idempotency key, and default payout method ownership.
- Checks `IdempotencyKey` via SHA-256 fingerprinting. Identical requests return cached results; mismatched bodies return `:idempotency_conflict`.
- Initiates an `ActiveRecord::Base.transaction` and acquires a pessimistic row lock: `User.lock("FOR UPDATE").find(user.id)`.
- Verifies balance sufficiency under lock; generates closed-loop plan; mutates balance; creates withdrawal; writes ledger debit (`-amount_cents`); creates payout legs; and decrements `Deposit#unrefunded_principal_cents`.
- **Decoupled Provider Dispatch:** External network calls (`@payout_provider.dispatch`) are executed **outside** the database transaction, eliminating connection pool exhaustion and long-held row locks during third-party latency.

### 2. Closed-Loop Routing Algorithm (`ClosedLoopResolver`)
- Filters candidate deposits for the user where `unrefunded_principal_cents > 0`.
- Acquires row locks on candidate deposits in deterministic order (`settled_at ASC, id ASC`).
- Categorizes deposits into eligible vs. conflicting asset families (`:fiat` vs. `:crypto`).
- **Cross-Asset Refusal:** If a withdrawal requires funds beyond eligible deposits and the user holds unrefunded deposits in a conflicting asset family, the resolver raises `CrossAssetError`, halting the withdrawal.
- Allocates funds FIFO across eligible deposits; routes any remaining residual to the user's default payout method.

### 3. Decoupled Dispatch & Exact-Once Compensation (`PayoutDispatcher`)
- Calls provider with a deterministic composite idempotency key: `#{withdrawal.idempotency_key}:leg:#{leg.id}`.
- Normalizes provider responses:
  - `:submitted`: Leg state updated to `submitted` (non-terminal).
  - `:failed`: Leg state updated to `failed`; immediately triggers `compensate_failed_leg!` restoring user balance and appending a `withdrawal_reversal` ledger entry with a unique reference `"payout_leg:#{leg.id}:reversal"`.
  - `:unknown` or timeout: Leg state updated to `unknown` (non-terminal). No balance reversal and no automatic retry.

### 4. Replay-Safe Webhooks (`WithdrawalWebhookHandler`)
- Deduplicates inbound events via `WebhookEvent.create_or_find_by!(external_event_id:)`.
- Replayed events (already having `processed_at`) exit immediately as safe no-ops.
- **Guarded Transitions:** Prevents invalid state regressions from terminal states (`settled`, `failed`).
- **Late Failure Guard:** If a leg is already `settled`, a subsequent late failure webhook is safely ignored without reversing funds.
- Aggregates overall `Withdrawal` state to `settled` once all constituent payout legs have settled.

### 5. Append-Only Ledger (`LedgerEntry`)
- Disables automatic timestamp mutation (`self.record_timestamps = false`).
- Overrides `#readonly?`, `#delete`, `before_update`, and `before_destroy` to raise `ActiveRecord::ReadOnlyRecord`.
- Debits are stored as negative amounts; reversals and deposits are stored as positive amounts.
- Mathematically guarantees:
  $$\text{Opening Balance} + \sum(\text{Ledger Entry Deltas}) = \text{Current Balance}$$

---

## Verification & Acceptance Suite

The implementation is verified by a 25-example RSpec test suite covering the full R1–R16 acceptance matrix:

| Scenario | Invariant Tested | Status |
| :--- | :--- | :---: |
| **R1** | Single deposit refunded FIFO to original instrument | PASS |
| **R2** | Oldest deposit fully exhausted before next deposit is allocated | PASS |
| **R3** | Residual excess routed to default payout method | PASS |
| **R4** | Refusal of cross-asset combinations (fiat ↔ crypto) | PASS |
| **R5** | Payout method owned by another user rejected | PASS |
| **R6** | Non-positive, float, or string amounts rejected | PASS |
| **R7** | Idempotent replay returns cached result with zero duplicate financial side effects | PASS |
| **R8** | Idempotency conflict on parameter mismatch returns 409 error | PASS |
| **R9** | Multithreaded concurrency: parallel threads cannot overdraft balance | PASS |
| **R10** | Provider `:submitted` updates state without ledger reversal | PASS |
| **R11** | Provider `:failed` executes exactly-once reversal restoring balance | PASS |
| **R12** | Provider `:unknown` leaves leg non-terminal with no reversal and no retry | PASS |
| **R13** | Duplicate webhook event delivery is an idempotent no-op | PASS |
| **R14** | Late failure webhook after settlement does not reverse funds | PASS |
| **R15** | Mathematical reconciliation between balance and ledger deltas | PASS |
| **R16** | Strict ledger immutability blocking update and delete | PASS |

---

## Local Setup & Testing

### Prerequisites
- **Ruby:** 3.3.x (managed via `mise`, `asdf`, or `rbenv` per `.tool-versions`)
- **PostgreSQL:** 15+
- **Bundler:** 2.5+

### Installation & Execution
```bash
# 1. Install dependencies
bundle install

# 2. Configure database environment (if different from default localhost:5432)
export SOAP_DB_USER="postgres"
export SOAP_DB_PORT="5432"
export SOAP_DB_NAME="soap_test"

# 3. Migrate test database
bundle exec rake db:migrate

# 4. Run full test suite
bundle exec rspec
```

---

## Scope & Production Hardening Roadmap

> **Note on Scope:** This repository is a technical portfolio implementation of a payments orchestration service. It is designed to demonstrate financial software correctness, concurrency safety, and transaction integrity. It does not constitute a certified production deployment or licensed money-transmission service.

### Recommended Production Enhancements
1. **Cryptographic Webhook Verification:** Implement HMAC-SHA256 signature verification on incoming webhook payloads against a shared provider secret.
2. **Transactional Outbox Worker:** Decouple payout leg dispatch and webhook processing into an asynchronous job pipeline (e.g., Solid Queue or Sidekiq) backed by an outbox table.
3. **Observability & Telemetry:** Instrument OpenTelemetry spans, structured JSON logging with correlation IDs, and Prometheus metrics for payout dispatch latency, failure rates, and reversal frequency.
4. **Database Triggers:** Supplement application-level ledger immutability with PostgreSQL database-level `BEFORE UPDATE OR DELETE` triggers.
