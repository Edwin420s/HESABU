# HESABU

**Collaborative Financial Operations, Multi-Rail Settlements, and Autonomous Accounting Platform**

HESABU is a financial operations and payment coordination platform designed for savings groups (chamas), student associations, non-governmental organizations, cooperatives, and small-to-medium enterprises.

The platform provides unified management of member dues, targeted goal campaigns, multi-member expense splitting, out-of-pocket reimbursements, recurring dues automation, multi-rail verified settlements (Stellar USDC and Safaricom M-Pesa), double-entry accounting records, and an interactive Autonomous Financial Copilot.

---

## What Problem HESABU Solves

Managing collective money in informal and semi-formal groups is traditionally fragmented across chat messages, mobile money SMS confirmations, spreadsheets, and paper receipts. This creates persistent operational challenges:

- **Unclear Liability vs. Cash**: Promising to pay is often conflated with confirmed funds received.
- **Verification Gaps**: Payment claims are difficult to cross-check across multiple payment methods.
- **Lack of Spending Controls**: Group members spend out-of-pocket without formal approval workflows or clear reimbursement paths.
- **Disputed Records**: Without balanced accounting ledgers, members frequently dispute account totals during annual meetings or audits.

HESABU replaces this fragmentation with a disciplined, transparent financial operations hub.

---

## Core Product Capabilities

### 1. Contributions and Member Obligations
- Create structured payment obligations with assigned members, due dates, and exact minor-unit currency amounts.
- Maintain a real-time status lifecycle: Open, Partially Paid, Settled, and Cancelled.
- Calculate outstanding balances strictly from verified settlement records.

### 2. Campaigns and Goal-Oriented Fundraising
- Create targeted initiatives (such as land acquisition, emergency welfare funds, or event budgets) with defined funding targets and deadlines.
- Track real-time progress bars showing settled amounts against targets.
- Allow members to pledge and settle contributions directly linked to specific campaigns.

### 3. Expenses and Multi-Member Cost Splitting
- Submit organizational expenses with itemized categories, descriptions, and supporting receipts.
- Split costs across participating members using equal, exact, or percentage allocations.
- Enforce separation of duties: expenses submitted by an officer must be independently approved before payout.

### 4. Member Out-of-Pocket Reimbursements
- Allow members who spend personal funds on group needs to file reimbursement claims with receipt proof.
- Route claims through multi-tier approvals prior to disbursement.
- Automatically record balanced double-entry ledger entries upon payout.

### 5. Recurring Dues Automation
- Configure automated recurring schedules for weekly, monthly, quarterly, or annual chama dues.
- Generate batch obligations across all active workspace members with a single trigger.
- Maintain forward visibility into upcoming billing cycles.

### 6. Multi-Rail Verified Settlement
- **Stellar Network**: On-chain verification using live Horizon API lookups. Validates transaction finality, account destination, payment reference memos, and asset details with cryptographic anti-replay protection.
- **Safaricom M-Pesa**: Direct STK Push requests to payer handsets, receipt number tracking, and public webhook callback processing.
- **Sandbox Simulation**: Deterministic payment simulation for testing and team onboarding.

### 7. Autonomous Financial Copilot
- Natural language query assistant capable of analyzing treasury cash balances, runway, overdue member contributions, and unapproved expenditures.
- Continuous reconciliation engine auditing double-entry equality and settlement finality.
- Proactive action items highlighting overdue dues or reconciliation discrepancies.

### 8. Double-Entry Ledger and Financial Statements
- Immutable general ledger posting balanced debit and credit lines for every confirmed financial movement.
- Real-time Trial Balance verifying ledger equality with zero mathematical discrepancies.
- Income Statement (Profit & Loss) tracking recognized revenue against operating costs to establish net surplus or deficit.
- Reversal workflow that preserves historical auditability by creating linked counter-entries rather than deleting rows.

### 9. Cryptographic Statement Anchors
- Periodically fingerprints journal entries into a canonical SHA-256 Merkle root.
- Produces tamper-proof cryptographic proofs of financial periods for external auditors, chamas, and regulatory bodies.

### 10. Multi-Tenant Role-Based Access Control
- Tenant isolation across workspaces (Group, Organisation, Personal).
- Fine-grained permissions for Owners, Administrators, Finance Managers, Approvers, Members, and Auditors.

---

## Product Documentation

Detailed guides and operational specifications are available in the `docs/` directory:

- [Product User Guide](docs/USER_GUIDE.md): Comprehensive functional walkthrough of all platform workflows.
- [Product Requirements](docs/PRODUCT_REQUIREMENTS.md): Functional and business requirements.
- [Financial Model](docs/FINANCIAL_MODEL.md): Accounting concepts, minor units, and ledger structures.
- [System Architecture](docs/SYSTEM_ARCHITECTURE.md): Component topology, state machines, and data flow.
- [API Specification](docs/API_SPECIFICATION.md): Complete REST endpoint reference.
- [Security Guidelines](docs/SECURITY.md): Access controls, boundaries, and best practices.
- [Stellar Integration](docs/STELLAR_INTEGRATION.md): On-chain verification and memo handling.

---

## Getting Started

### Prerequisites
- Node.js 20 or higher
- Docker Engine and Docker Compose
- PostgreSQL (Docker Compose exposes port 5433)

### Running Locally

1. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```

2. **Start the Database**:
   ```bash
   docker compose up -d db
   ```

3. **Initialize and Start the Backend**:
   ```bash
   cd backend
   npm install
   npx prisma db push
   npm run db:seed
   npm run dev
   ```
   The backend API runs at `http://localhost:4000`. Health endpoint: `http://localhost:4000/api/health`.

4. **Start the Frontend Application**:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   Access the web interface at `http://localhost:5173`.

### Demo Account
- **Email**: `demo@hesabu.local`
- **Password**: `HesabuDemo!2026`
