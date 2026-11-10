# HESABU Product Requirements

**Version:** 1.0 · **Classification:** Product Requirements Document

---

## 1. Product Definition

HESABU is a collaborative financial operations and payment coordination platform. It gives savings groups (chamas), student associations, non-governmental organizations, cooperatives, and small-to-medium enterprises a shared system to organize financial responsibilities, coordinate collections, review spending, verify multi-rail settlements, and maintain accountable, double-entry accounting records.

It is designed to eliminate information asymmetry, informal tracking errors, and disputes over shared funds.

---

## 2. Problem Statement

Financial operations in collective organizations are routinely fragmented across mobile-money SMS messages, disparate bank accounts, unorganized spreadsheets, chat groups, and paper receipts. 

This fragmentation causes severe organizational problems:
- Inability to verify who has paid versus who is merely promising to pay.
- Lack of auditability over who authorized withdrawals or payments.
- Disorganized out-of-pocket spending by members without clear reimbursement procedures.
- Inconsistent bookkeeping that fails basic accounting reconciliation, leading to distrust and dispute.

---

## 3. Product Principles

1. **Strict Financial Separation**:
   Obligation != Payment Attempt != Settlement != Expense != Journal Entry.
2. **Deterministic Settlement Verification**:
   Payment status is independently verified via settlement rail confirmation (Stellar Horizon on-chain verification or Safaricom M-Pesa receipts/callbacks), never assumed from user interface clicks.
3. **Double-Entry Accounting Core**:
   Every settlement, payout, and reimbursement atomically posts balanced debit and credit ledger lines.
4. **Zero Floating-Point Drift**:
   All monetary amounts are represented as integer minor units (`BigInt` / cents).
5. **Separation of Duties**:
   Users who submit expenses or claims cannot approve their own submissions.
6. **Immutable Historical Auditability**:
   Posted entries are never deleted or modified; corrections are executed via linked reversal counter-entries.
7. **Cryptographic Proof of Records**:
   Financial periods are cryptographically anchored using canonical SHA-256 Merkle root fingerprints.
8. **Tenant Isolation**:
   All financial records, memberships, and operations are strictly partitioned per workspace.

---

## 4. User Personas and Roles

- **Owner**: Exercises ultimate administrative control over workspace settings, membership, and governance.
- **Administrator**: Invites and manages workspace members, configures roles, and oversees operations.
- **Finance Manager**: Creates obligations, launches goal campaigns, sets recurring dues schedules, and disburses payouts.
- **Approver**: Reviews, approves, or rejects submitted expenses and reimbursement claims with required justification.
- **Member**: Views assigned contribution obligations, initiates payments, submits expenses, and files reimbursement claims.
- **Auditor**: Holds read-only inspection access to the general ledger, audit trails, trial balance, and statement anchors.

---

## 5. Functional Requirements

### 5.1 Identity and Multi-Tenancy Workspaces
- Register and authenticate users with secure credential hashing and token-based sessions.
- Support multiple workspaces per user across Personal, Group, and Organisation types.
- Enforce tenant isolation and server-side role validation on every API endpoint.

### 5.2 Contributions and Obligations
- Create obligations with title, assigned member, amount in integer minor units, and due dates.
- Support complete obligation lifecycle: Open, Partially Paid, Settled, and Cancelled.
- Calculate outstanding balances strictly from verified settlements.

### 5.3 Goal-Oriented Campaigns
- Configure targeted fundraising goals with monetary targets, start dates, and deadlines.
- Display visual real-time progress indicators showing percentage of target settled.
- Link member obligations directly to specific campaigns.

### 5.4 Expenses and Multi-Member Splits
- Submit expenses with category classification, descriptions, and supporting receipts.
- Support splitting expenses among members (equal, exact, or percentage allocations).
- Provide dual-control approval workflows with mandatory rejection reasons.

### 5.5 Member Out-of-Pocket Reimbursements
- Allow members to file reimbursement claims for out-of-pocket costs with receipt proof.
- Provide approval mechanisms for designated approvers.
- Automatically execute balanced double-entry ledger postings upon payout.

### 5.6 Automated Recurring Dues
- Configure recurring dues schedules (Weekly, Monthly, Quarterly, Annually).
- Execute automated 1-click batch obligation generation across all workspace members.
- Maintain transparent records of recurrence runs and next due dates.

### 5.7 Multi-Rail Settlement Verification
- **Stellar Network**: Live Horizon API validation confirming transaction hash uniqueness, ledger finality, recipient address, and memo references.
- **Safaricom M-Pesa**: Direct STK Push processing, receipt number verification, and public webhook callback handling.
- **Development Sandbox**: Deterministic local simulation for testing and training.

### 5.8 Double-Entry Ledger and Reporting
- Atomically record balanced debit and credit entries in integer minor units.
- Real-time Trial Balance verifying total debits equal total credits.
- Income Statement (Profit & Loss) tracking recognized contribution revenue against operating expenses.
- Reversal counter-entries preserving full audit history.
- CSV export of general ledger records.

### 5.9 Cryptographic Statement Anchors
- Compute canonical SHA-256 Merkle root fingerprints of all journal entries within an audit period.
- Lock historical financial periods for tamper-proof external auditing.

### 5.10 Autonomous Financial Copilot
- Natural language query interface for real-time analysis of treasury balances, burn rate, and overdue dues.
- Continuous reconciliation engine auditing ledger equality and unreviewed transactions.

---

## 6. Success Measures

- 100% reconciliation rate: Total ledger debits strictly equal total credits.
- Zero duplicate settlement transactions via idempotency and hash uniqueness.
- Traceable auditability for every financial action and approval.
- Reduced dispute rates during organizational AGMs and financial reviews.
