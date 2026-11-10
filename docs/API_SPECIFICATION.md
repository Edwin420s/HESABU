# API Specification

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

## 2. Workspaces and Membership

- `GET /workspaces`
  - Lists all workspaces accessible by the authenticated user
- `POST /workspaces`
  - Body: `{ name, type: "PERSONAL" | "GROUP" | "ORGANISATION", currency }`
- `GET /workspaces/:workspaceId`
  - Returns workspace metadata and active member list
- `POST /workspaces/:workspaceId/members`
  - Body: `{ email, role: "MEMBER" | "APPROVER" | "FINANCE_MANAGER" | "AUDITOR" | "ADMIN" }`
- `DELETE /workspaces/:workspaceId/members/:memberId`
  - Removes a member from the workspace

---

## 3. Contributions and Obligations

- `GET /workspaces/:workspaceId/obligations`
  - Lists obligations in the workspace with current settlement status
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

## 5. Expenses and Multi-Member Splits

- `GET /workspaces/:workspaceId/expenses`
  - Lists expenses with current approval status and split allocations
- `POST /workspaces/:workspaceId/expenses`
  - Body: `{ title, category, amount, description?, receiptUrl?, splits?: [{ memberId, shareMinor }] }`
- `POST /expenses/:id/approve`
  - Approves a submitted expense (enforcing separation of duties)
- `POST /expenses/:id/reject`
  - Body: `{ note }`
- `POST /expenses/:id/pay`
  - Records payout for an approved expense and posts balanced entries to the double-entry journal

---

## 6. Member Reimbursements

- `GET /workspaces/:workspaceId/reimbursements`
  - Lists out-of-pocket reimbursement claims
- `POST /workspaces/:workspaceId/reimbursements`
  - Body: `{ title, description?, category, amountMinor, receiptUrl? }`
- `POST /reimbursements/:id/approve`
  - Approves a submitted claim
- `POST /reimbursements/:id/reject`
  - Body: `{ reason }`
- `POST /reimbursements/:id/pay`
  - Disburses approved claim and posts balanced ledger lines (`DR 5050`, `CR 1000`)

---

## 7. Recurring Dues Schedules

- `GET /workspaces/:workspaceId/recurring`
  - Lists configured recurring dues schedules
- `POST /workspaces/:workspaceId/recurring`
  - Body: `{ title, amountMinor, interval: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY", nextRunAt }`
- `POST /recurring/:id/trigger`
  - Immediately executes the recurring billing cycle, generating obligations for all workspace members

---

## 8. Payments and Multi-Rail Settlements

- `GET /workspaces/:workspaceId/payments`
  - Lists payment attempts and settlement verification details
- `POST /obligations/:id/payments`
  - Body: `{ rail: "STELLAR" | "MPESA" | "DEVELOPMENT", phoneNumber?, idempotencyKey? }`
  - Initiates a pending payment attempt
- `POST /payments/:id/stellar-confirm`
  - Body: `{ txHash }`
  - Validates on-chain Stellar transaction via Horizon API and posts to journal
- `POST /payments/:id/mpesa-confirm`
  - Body: `{ receiptNumber }`
  - Confirms Safaricom M-Pesa receipt reference and posts to journal
- `POST /payments/mpesa-callback`
  - Public webhook handler processing asynchronous Daraja STK Push responses
- `POST /payments/:id/dev-confirm`
  - Sandbox confirmation for local testing and demonstration

---

## 9. Double-Entry General Ledger

- `GET /workspaces/:workspaceId/journal`
  - Lists posted balanced journal entries with debit and credit lines
- `POST /journal/:id/reverse`
  - Body: `{ reason }`
  - Generates a balanced reversing journal entry referencing the original record

---

## 10. Financial Statements and Reports

- `GET /workspaces/:workspaceId/reports/trial-balance`
  - Returns debit, credit, and net balances per account code, verifying ledger equality
- `GET /workspaces/:workspaceId/reports/income-statement`
  - Returns recognized revenue, total operating expenses, and net surplus or deficit
- `GET /workspaces/:workspaceId/reports/ledger.csv`
  - Exports a CSV file containing all posted journal lines for external review

---

## 11. Statement Anchors

- `GET /workspaces/:workspaceId/anchors`
  - Lists cryptographic period anchors
- `POST /workspaces/:workspaceId/anchors/generate`
  - Body: `{ periodStart, periodEnd }`
  - Computes and records a canonical SHA-256 Merkle root across journal entries in the window

---

## 12. Autonomous Financial Copilot

- `POST /workspaces/:workspaceId/agent/query`
  - Body: `{ query }`
  - Returns natural language answer, financial data context, and suggested follow-ups
- `GET /workspaces/:workspaceId/agent/reconcile`
  - Returns reconciliation status, totals, and proactive action items

---

## 13. Audit Trail

- `GET /workspaces/:workspaceId/audit`
  - Returns immutable audit logs with timestamp, action type, entity, and actor
