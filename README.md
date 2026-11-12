# HESABU

**Agentic Financial Operations, Multi-Rail Settlements, and Enterprise Autonomous Accounting Platform**

HESABU is a production-grade financial operations and autonomous payment coordination platform designed for savings groups (chamas), student associations, non-governmental organizations, cooperatives, and small-to-medium enterprises across East and Southern Africa (Kenya 🇰🇪 and South Africa 🇿🇦).

The platform provides unified management of member dues, targeted campaigns, multi-member expense splitting, out-of-pocket reimbursements, recurring dues automation, B2B invoicing, accounts payable supplier bills, procurement approvals, multi-rail verified settlements (Safaricom M-Pesa, Stellar Horizon USDC, and South Africa PayShap/EFT), GAAP double-entry accounting ledgers, binary Merkle tree cryptographic period anchors, and an intelligent FinNexus Agentic Finance Engine.

---

## Architectural Layers (Layers 1 – 4)

### Layer 1: Financial & Accounting Foundation
- **Integer Minor-Unit Math**: Zero floating-point rounding errors across KES, ZAR, USD, EUR, GBP, UGX, and TZS.
- **GAAP Double-Entry Ledger**: Immutable journal entries enforcing balanced Debits = Credits per individual currency.
- **Per-Currency Trial Balance**: Independent balance checks for multi-currency operations without currency commingling.
- **Reversals by Contra-Entry**: Immutable audit trail where modifications require reversing journal entries.
- **Persistent Member Obligations**: True outstanding balances derived directly from verified settlement transactions.

### Layer 2: Payment Coordination & Settlement Verification
- **Safaricom M-Pesa STK Push & Webhook**: Real-time STK trigger, callback verification with receipt numbers and checkout request ID tracking.
- **Stellar Horizon Blockchain Verification**: On-chain verification checking transaction finality, destination account, asset code, issuer, memo, and transfer amount.
- **South Africa PayShap & Bank EFT Adapter**: First-class ZAR clearing and immediate settlement rails.
- **Role-Restricted Manual Claims**: Prohibits unverified manual settlement; requires Owner/Admin role with mandatory audit justification.

### Layer 3: FinNexus Agentic Finance Engine
- **CollectionsAgent**: Analyzes open receivables, computes arrears, and drafts contextual payment reminders.
- **ReconciliationAgent**: Audits settlement matching against bank/chain rails and monitors ledger health.
- **TreasuryAgent**: Computes net cash balances, liquidity runway, and upcoming commercial payables across currencies.
- **ExpenseAgent**: Identifies duplicate expense claims and detects spending threshold policy breaches.
- **Natural Language Copilot**: Intelligently routes queries to typed financial subagents with structured responses.

### Layer 4: Multi-Market, Cross-Border & Commercial Enterprise
- **Kenya & South Africa Multi-Market**: Localized VAT/tax rates, country-specific clearing accounts, and localized currency formatting.
- **Commercial Invoicing & Accounts Receivable (AR)**: Customer directory, line-item commercial invoicing with automatic VAT calculation, and Accounts Receivable accrual posting.
- **Supplier Bills & Accounts Payable (AP)**: Vendor management, bill submission, spending limit authorization, and disbursement posting.
- **Procurement & Purchase Requests**: Formal purchase request workflow enforcing segregation of duties and dual-authorization limits.
- **Merry-Go-Round (ROSCA)**: Rotating group savings cycles, round payouts, and pot distribution journal posting.
- **Table Banking Loans**: Peer lending with amortization schedule calculation (Flat and Reducing Balance).
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

The platform is covered by 17 automated test suites:
- `tests/integration.test.js`: Full end-to-end multi-rail settlement, ledger reversals, and agent query workflows.
- `tests/invoicing.test.js`: B2B customer management, multi-line invoice issuance, VAT calculation, and settlement.
- `tests/billsAndProcurement.test.js`: Vendor bills, AP approval, PayShap disbursement, and procurement authorization.
- `tests/agent.test.js`: Specialized Collections, Reconciliation, Treasury, and Expense agents.
- `tests/merkle.test.js`: Binary Merkle tree generation, root consistency, inclusion proofs, and tamper rejection.
- `tests/money.test.js`: Integer minor units arithmetic and cross-currency conversions.
- `tests/fx.test.js`: Mid-market exchange rates, time-locked quotes, and spread deductions.
- `tests/rosca.test.js`: Rotating cycle creation, pot payouts, and round tracking.
- `tests/loans.test.js`: Table banking loan schedules, interest calculation, and repayments.
- `tests/budget.test.js`: Category allocation and actual-versus-budget variance tracking.
- `tests/soroban.test.js`: Statement anchor contract validation and inclusion verification.
- `tests/audit.test.js`: Audit logging, policy amendment tracking, and CSV audit export.
- `tests/notifications.test.js`: Multi-channel notification dispatch.
- `tests/webhookRetry.test.js`: Webhook retry exponential backoff and idempotency.
- `tests/statementPdf.test.js`: Financial statement report generation.
- `tests/analytics.test.js`: Workspace health score and financial metrics.
- `tests/health.test.js`: System health and status probes.

---

## License

MIT
