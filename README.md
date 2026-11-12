# HESABU

**Agentic Financial Operations, Multi-Rail Settlements, and Enterprise Autonomous Accounting Platform**

HESABU is an enterprise-grade financial operations and autonomous payment coordination platform designed for savings groups (chamas), student associations, non-governmental organizations, cooperatives, and small-to-medium enterprises across East and Southern Africa (Kenya 🇰🇪 and South Africa 🇿🇦).

The platform provides unified management of member dues, targeted campaigns, multi-member expense splitting, out-of-pocket reimbursements, recurring dues automation, B2B invoicing, accounts payable supplier bills, procurement approvals, multi-rail verified settlements (Safaricom M-Pesa, Stellar Horizon USDC, and South Africa PayShap/EFT), GAAP double-entry accounting ledgers, binary Merkle tree cryptographic period anchors, and an intelligent FinNexus Agentic Finance Engine.

---

## Architectural Layers (Layers 1 – 4)

### Layer 1: Financial & Accounting Foundation
- **Integer Minor-Unit Math**: Exact banker's/half-up integer rounding, scaled fractional quantities (4-decimal precision), basis-point tax calculations, and zero floating-point rounding errors across KES, ZAR, USD, EUR, GBP, UGX, and TZS.
- **GAAP Double-Entry Ledger**: Immutable journal entries enforcing balanced Debits = Credits per individual currency leg.
- **Multi-Currency Conduit Accounting**: Balanced cross-currency journal entries utilizing `1040-FX-CLEARING` and realized gain/loss accounts (`4500`/`5500`), eliminating the error of directly balancing disparate currencies against each other.
- **Per-Currency Trial Balance**: Independent balance checks for multi-currency operations without currency commingling.
- **Reversals by Contra-Entry**: Immutable audit trail where modifications require reversing journal entries.
- **Persistent Member Obligations**: True outstanding balances derived directly from verified settlement transactions.

### Layer 2: Payment Coordination & Settlement Verification
- **Safaricom M-Pesa STK Push & Webhook**: Real-time STK trigger, callback verification with receipt numbers, IP authorization checks, and checkout request ID tracking.
- **Stellar Horizon Blockchain Verification**: On-chain verification checking transaction finality, destination account, asset code, strict asset issuer validation (rejecting missing/mismatched issuers for issued assets like USDC), memo matching, and anti-replay protection.
- **South Africa PayShap & Bank EFT Adapter**: First-class ZAR clearing with HMAC-SHA256 signature verification, raw event persistence, anti-tampering validation, terminal status checks (`SETTLED`/`COMPLETED`), and anti-replay protection.
- **Role-Restricted Manual Claims**: Prohibits unverified manual settlement; requires Owner/Admin role with mandatory audit justification.

### Layer 3: FinNexus Agentic Finance Engine
- **Typed Tool Registry**: Strongly-typed tool definitions with JSON schema parameter validation and RBAC permission checks (`collect_receivables`, `reconcile_ledger`, `forecast_treasury`, `audit_expenses`).
- **CollectionsAgent**: Analyzes open receivables, computes arrears, and drafts contextual payment reminders.
- **ReconciliationAgent**: Audits settlement matching against bank/chain rails and monitors ledger health.
- **TreasuryAgent**: Computes net cash balances, liquidity runway, and upcoming commercial payables across currencies.
- **ExpenseAgent**: Identifies duplicate expense claims and detects spending threshold policy breaches.
- **Autonomous Tool Execution**: Audits tool invocations directly into the immutable `AuditLog` table.
- **Natural Language Copilot**: Intelligently routes queries to specialized financial subagents with structured responses.

### Layer 4: Multi-Market, Cross-Border & Commercial Enterprise
- **Kenya & South Africa Multi-Market**: Localized VAT/tax rates, country-specific clearing accounts, and localized currency formatting.
- **Commercial Invoicing & Accounts Receivable (AR)**: Customer directory, line-item commercial invoicing with automatic basis-point VAT calculation, and Accounts Receivable accrual posting.
- **Partial Settlements & Invoice Allocations**: Durable `InvoiceAllocation` records tracking partial payments and updating invoice balances without premature status flips.
- **Credit Notes**: Formal credit note issuance (`CreditNote`, `CreditNoteLine`) reversing revenue and accounts receivable with GAAP contra-entries.
- **Supplier Bills & Accounts Payable (AP)**: Vendor management, bill submission, spending limit authorization, and disbursement posting.
- **Procurement & Purchase Requests**: Formal purchase request workflow enforcing segregation of duties and dual-authorization limits.
- **Merry-Go-Round (ROSCA)**: Rotating group savings cycles, round payouts, and durable pot distribution journal posting.
- **Table Banking Loans**: Peer lending with amortization schedule calculation (Flat and Reducing Balance) and durable schedule rows (`LoanScheduleRow`).
- **Budget Variance**: Operational spending monitoring and real-time category utilization tracking.
- **Multi-Currency FX & Cross-Rates**: Institutional quotes, time-locked conversion quotes, and cross-border conversion execution.
- **Cryptographic Statement Anchors**: Binary Merkle tree construction over fiscal periods with leaf inclusion proofs verified on-chain and locally.

---

## Quick Start & Verification

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 14
- Rust & Cargo (for Soroban smart contracts)

### Backend Setup
```bash
cd backend
npm install
npx prisma db push
npm run db:seed
npm test
```

### Frontend Setup
```bash
cd frontend
npm install
npm run build
```

### Soroban Contracts Setup
```bash
cd contracts/soroban
cargo test
```

---

## Test Suites Summary

The platform is covered by 17 comprehensive automated test suites:
- `tests/integration.test.js`: Full end-to-end multi-rail settlement (Stellar Horizon live on-chain, M-Pesa STK/callback, PayShap webhook with HMAC-SHA256, PayShap admin confirmation with anti-replay), ledger reversals, and agent query workflows.
- `tests/invoicing.test.js`: B2B customer management, multi-line invoice issuance, basis-point VAT calculation, partial settlements, durable invoice allocations, credit notes, and overpayment prevention.
- `tests/billsAndProcurement.test.js`: Vendor bills, AP approval, PayShap disbursement, and procurement authorization.
- `tests/agent.test.js`: Specialized Collections, Reconciliation, Treasury, and Expense agents, typed tool registry, and audit-logged tool execution.
- `tests/merkle.test.js`: Binary Merkle tree generation, root consistency, inclusion proofs, and tamper rejection.
- `tests/money.test.js`: Integer minor units arithmetic, scaled quantities, tax calculation in basis points, and cross-currency conversions.
- `tests/fx.test.js`: Mid-market exchange rates, persistent quotes, spread deductions, and multi-currency balanced journal entries via `1040-FX-CLEARING`.
- `tests/rosca.test.js`: Rotating cycle creation, pot payouts, round tracking, and durable PostgreSQL persistence.
- `tests/loans.test.js`: Table banking loan schedules, interest calculation, amortization schedule rows, and repayments.
- `tests/budget.test.js`: Category allocation and actual-versus-budget variance tracking.
- `tests/soroban.test.js`: Statement anchor contract validation and inclusion verification.
- `tests/audit.test.js`: Audit logging, policy amendment tracking, and CSV audit export.
- `tests/notifications.test.js`: Multi-channel notification dispatch.
- `tests/webhookRetry.test.js`: Webhook retry exponential backoff and idempotency.
- `tests/statementPdf.test.js`: Financial statement report generation.
- `tests/analytics.test.js`: Workspace health score and financial metrics.
- `tests/health.test.js`: System health and status probes.

---

## Continuous Integration

GitHub Actions CI is configured in `.github/workflows/ci.yml` verifying:
1. Backend test suite against PostgreSQL 16
2. Frontend production build and asset bundling
3. Soroban smart contract verification

---

## License

MIT
