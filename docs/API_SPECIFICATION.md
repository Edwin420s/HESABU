# HESABU API Specification

Base URL: `/api`

Authentication: All protected endpoints require `Authorization: Bearer <access-token>`.

---

## 1. Authentication

- `POST /auth/register`
  - Body: `{ name, email, password }`
  - Returns: `{ user, token }`
- `POST /auth/login`
  - Body: `{ email, password }`
  - Returns: `{ user, token }`
- `GET /auth/me`
  - Returns: Current authenticated user details

---

## 2. Workspaces and Multi-Market Tenancy

- `GET /workspaces`
  - Lists all workspaces accessible by the authenticated user with role and profile
- `POST /workspaces`
  - Body: `{ name, type: "PERSONAL" | "GROUP" | "ORGANISATION", currency: "KES" | "ZAR" | "USD" | "EUR" }`
  - Initializes workspace with GAAP chart of accounts and default tenant currency
- `GET /workspaces/:workspaceId`
  - Returns workspace metadata, profile, country (`KE` or `ZA`), and member list
- `POST /workspaces/:workspaceId/members`
  - Body: `{ email, role: "MEMBER" | "APPROVER" | "FINANCE_MANAGER" | "AUDITOR" | "ADMIN" }`
- `DELETE /workspaces/:workspaceId/members/:memberId`
  - Removes a member from the workspace

---

## 3. Contributions and Persistent Obligations

- `GET /workspaces/:workspaceId/obligations`
  - Lists obligations in the workspace with current settlement status and remaining balance
- `POST /workspaces/:workspaceId/obligations`
  - Body: `{ title, memberName, amount, description?, memberEmail?, dueAt?, campaignId? }`
- `POST /obligations/:id/cancel`
  - Cancels an open or partially paid obligation

---

## 4. Campaigns and Goals

- `GET /workspaces/:workspaceId/campaigns`
  - Lists fundraising campaigns, target progress percentages, and pledged amounts
- `POST /workspaces/:workspaceId/campaigns`
  - Body: `{ title, description?, targetMinor, startsAt?, endsAt? }`
- `POST /campaigns/:campaignId/obligations`
  - Body: `{ memberName, memberEmail?, amountMinor, dueAt? }`
  - Creates a member obligation linked directly to the specified campaign

---

## 5. Commercial Invoicing & Accounts Receivable (Layer 4)

- `GET /workspaces/:workspaceId/customers`
  - Lists registered corporate/individual customers
- `POST /workspaces/:workspaceId/customers`
  - Body: `{ name, email, phone?, taxId?, address?, notes? }`
  - Registers a customer for B2B billing
- `GET /workspaces/:workspaceId/invoices`
  - Lists commercial invoices with line items and settlement state
- `POST /workspaces/:workspaceId/invoices`
  - Body: `{ customerId, invoiceNumber, dueDate, lines: [{ description, quantity, unitPrice }] }`
  - Computes subtotal, VAT/tax, issues invoice, and posts GAAP Accounts Receivable (`1200`) accrual journal
- `POST /invoices/:id/settle`
  - Body: `{ rail: "MPESA" | "STELLAR" | "PAYSHAP_EFT" | "DEVELOPMENT", paymentRef? }`
  - Settles invoice, credits AR (`1200`), debits cash/bank clearing (`1000`/`1030`)

---

## 6. Supplier Bills & Accounts Payable (Layer 4)

- `GET /workspaces/:workspaceId/suppliers`
  - Lists registered suppliers and bank settlement details
- `POST /workspaces/:workspaceId/suppliers`
  - Body: `{ name, email, phone?, bankName?, bankAccount?, taxId?, address? }`
- `GET /workspaces/:workspaceId/bills`
  - Lists supplier bills by approval and payment status
- `POST /workspaces/:workspaceId/bills`
  - Body: `{ supplierId, billNumber, amount, category, dueDate, notes? }`
  - Submits vendor bill for governance review
- `POST /bills/:id/approve`
  - Authorizes supplier bill and posts expense accrual to Accounts Payable (`2000`)
- `POST /bills/:id/pay`
  - Body: `{ rail: "PAYSHAP_EFT" | "MPESA" | "STELLAR", paymentRef? }`
  - Disburses supplier payment, debits AP (`2000`), credits cash/bank (`1000`/`1030`)

---

## 7. Procurement & Purchase Requests (Layer 4)

- `GET /workspaces/:workspaceId/purchase-requests`
  - Lists procurement requests with requester details and status
- `POST /workspaces/:workspaceId/purchase-requests`
  - Body: `{ title, description?, amount, department }`
- `POST /purchase-requests/:id/review`
  - Body: `{ decision: "APPROVED" | "REJECTED", note? }`
  - Enforces segregation of duties (requester cannot approve own request) and spending limits

---

## 8. Multi-Rail Payments & Settlements

- `POST /obligations/:id/payments`
  - Body: `{ rail: "MPESA" | "STELLAR" | "PAYSHAP_EFT" | "DEVELOPMENT", phoneNumber?, destinationAccount? }`
  - Initiates payment attempt in pending status prior to external verification
- `POST /payments/:id/mpesa-confirm`
  - Safaricom Daraja STK Push trigger
- `POST /payments/mpesa-callback`
  - Validates callback amount, phone, ResultCode, saves receipt number and checkout ID
- `POST /payments/:id/stellar-confirm`
  - Body: `{ txHash, destinationAccount, memo? }`
  - Strict Horizon verification of destination account, asset code, issuer, memo, and amount
- `POST /payments/:id/payshap-confirm`
  - South African immediate bank clearing confirmation
- `POST /payments/:id/claim-manual`
  - Role-restricted manual confirmation (Owner/Admin only) with mandatory audit justification

---

## 9. Merry-Go-Round (ROSCA) & Table Banking Loans

- `GET /workspaces/:workspaceId/rosca/cycles`
  - Lists rotating cycles, round payouts, and membership positions
- `POST /workspaces/:workspaceId/rosca/cycles`
  - Body: `{ name, contributionPerMemberMinor, frequencyDays, memberIds: [] }`
- `POST /rosca/cycles/:cycleId/rounds/:roundNumber/payout`
  - Executes pot disbursement to round beneficiary with double-entry journal posting
- `GET /workspaces/:workspaceId/loans`
  - Lists table banking loans with repayment schedules
- `POST /workspaces/:workspaceId/loans/apply`
  - Body: `{ borrowerMemberId, principalMinor, durationMonths, interestRateAnnual, interestType: "FLAT" | "REDUCING_BALANCE" }`
- `POST /loans/:loanId/approve`
  - Approves and disburses table banking loan
- `POST /loans/:loanId/repayments`
  - Records loan principal + interest repayment

---

## 10. Multi-Currency FX & Cross-Border Conversions

- `GET /fx/rates`
  - Mid-market exchange rates for KES, ZAR, USD, EUR, GBP, UGX, TZS
- `POST /fx/convert`
  - Body: `{ amountMinor, fromCurrency, toCurrency, spreadPercentage? }`
  - Exact minor-unit cross-rate conversion
- `POST /workspaces/:workspaceId/fx/quote`
  - Issues time-locked institutional conversion quote persisted to PostgreSQL
- `POST /workspaces/:workspaceId/fx/execute`
  - Body: `{ quoteRef, settlementRef? }`
  - Locks and executes FX trade, posting multi-currency balanced journal entries

---

## 11. Statement Anchors & Cryptographic Audit Verification

- `POST /workspaces/:workspaceId/anchors/generate`
  - Body: `{ periodStart, periodEnd }`
  - Canonicalizes all period journal entries, constructs binary Merkle tree, and produces 32-byte SHA-256 Merkle root
- `GET /workspaces/:workspaceId/anchors`
  - Lists generated cryptographic anchors
- `POST /workspaces/:workspaceId/anchors/verify-leaf`
  - Body: `{ journalEntryId, anchorId }`
  - Computes inclusion proof and validates leaf hash against immutable Merkle root

---

## 12. Agentic Finance Copilot (Layer 3)

- `POST /workspaces/:workspaceId/agent/query`
  - Body: `{ query }`
  - Routes natural language questions to specialized subagents:
    - `CollectionsAgent`: Overdue balances, remaining debt, reminder drafts
    - `ReconciliationAgent`: Ledger integrity, unmatched settlements, currency balances
    - `TreasuryAgent`: Liquidity forecasting, upcoming AP commitments, cash runway
    - `ExpenseAgent`: Anomaly detection, duplicate claims, threshold breaches
- `GET /workspaces/:workspaceId/agent/reconcile`
  - Evaluates automated settlement matching and double-entry trial balance
