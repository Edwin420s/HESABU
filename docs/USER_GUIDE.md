# HESABU Product User Guide

A practical guide to coordinating group finances, shared expenses, collections, and verified settlements.

---

## 1. Introduction

HESABU is a collaborative financial operations and payment coordination platform designed for savings groups (chamas), student associations, non-governmental organizations, cooperatives, and small-to-medium enterprises. 

In shared organizations, money management often breaks down because records are scattered across chat groups, mobile money SMS confirmations, paper receipts, and spreadsheets. Questions arise constantly:
- Who has paid their share, and who is overdue?
- What funds have actually been verified in the account versus promised?
- Who authorized a given withdrawal or expenditure?
- Do the books balance?

HESABU answers these questions through a single, structured system built on real accounting principles, multi-rail verified settlements, and role-based accountability.

---

## 2. Fundamental Principles

HESABU operates on four fundamental rules:

1. **Obligation is Not Money**:
   Creating a dues obligation establishes what a member is expected to pay. It creates an expected receivable, not cash. Money is recognized only after external settlement verification.

2. **Payment Attempts Require Independent Proof**:
   Clicking "Pay" creates a payment attempt. The platform marks an obligation settled only when the transaction is independently confirmed by the settlement rail (such as Safaricom M-Pesa or the Stellar blockchain network).

3. **Every Movement Balances in the Ledger**:
   Confirmed settlements, payouts, and approved reimbursements atomically post balanced debit and credit entries to an immutable double-entry journal.

4. **Zero Approvals in Isolation**:
   Individuals who submit expenses cannot approve their own expenses. Separation of duties ensures transparency and protects shared group funds.

---

## 3. Workspaces and Roles

### 3.1 Workspaces
Every activity in HESABU takes place inside a workspace. A user can belong to multiple workspaces (for example, a personal project, a family welfare chama, and a professional association).

Workspace types include:
- **Group**: Tailored for chamas, investment clubs, and community groups.
- **Organisation**: Designed for formal cooperatives, NGOs, and businesses.
- **Personal**: For individual financial tracking and self-managed initiatives.

### 3.2 Roles and Permissions
Permissions inside a workspace are role-based:

| Role | Responsibilities and Privileges |
|---|---|
| **Owner** | Full governance control, workspace settings, role assignments, and member management. |
| **Administrator** | Configures workspace settings, invites members, and oversees operations. |
| **Finance Manager** | Creates obligations, launches campaigns, sets recurring schedules, and executes payouts. |
| **Approver** | Reviews and approves or rejects submitted expenses and member reimbursement claims. |
| **Member** | Views assigned dues, tracks personal payment history, initiates payments, and submits expense claims. |
| **Auditor** | Read-only inspection access to the double-entry journal, audit trail, trial balance, and statement anchors. |

---

## 4. Contributions and Dues

### 4.1 Creating an Obligation
1. Navigate to **Contributions** in the sidebar.
2. Select **New Obligation**.
3. Enter the title, assigned member name, email address (optional), amount in local currency, and payment due date.
4. Select **Save Record**. The obligation is created in the **OPEN** state.

### 4.2 Tracking Statuses
- **OPEN**: Awaiting payment initiation.
- **PARTIALLY PAID**: A portion of the obligation has been settled.
- **SETTLED**: The obligation has been settled in full.
- **CANCELLED**: The obligation was cancelled by an authorized manager.

---

## 5. Campaigns and Goal-Oriented Fundraising

When an organization needs to raise funds for a specific objective (such as buying land, funding a student trip, or responding to an emergency), it can create a Campaign.

### 5.1 Creating a Campaign
1. Navigate to **Campaigns & Goals**.
2. Click **New Campaign**.
3. Specify the campaign title, purpose description, total fundraising target amount, start date, and target deadline.
4. The dashboard displays a live progress bar showing total funds pledged and settled toward the goal.

### 5.2 Adding Pledges
Members can add pledges directly against an active campaign. Each pledge creates an obligation tied to that campaign, tracking individual member fulfillment toward the group target.

---

## 6. Expenses and Multi-Member Splits

### 6.1 Submitting an Expense
1. Navigate to **Expenses & Splits**.
2. Select **Add Expense**.
3. Enter the expense title, category (Operations, Venue, Transport, Food, Equipment, Marketing, Welfare, or Other), amount, and description.
4. Select **Save Record**. The expense is placed in **SUBMITTED** status.

### 6.2 Review and Approval Workflow
- An assigned **Approver** reviews the submitted expense.
- The Approver can select **Approve** or **Reject** (providing a mandatory reason for rejection).
- Once approved, a **Finance Manager** or **Administrator** can select **Record Payout**, which disburses the funds and atomically records the double-entry journal entry.

---

## 7. Member Out-of-Pocket Reimbursements

Members often purchase supplies or services using personal funds and need to be reimbursed by the collective treasury.

### 7.1 Filing a Claim
1. Navigate to **Reimbursements**.
2. Click **Submit Claim**.
3. Enter the claim description, category, total amount spent, and an optional link or receipt reference.
4. The claim enters **SUBMITTED** status.

### 7.2 Review and Disbursement
1. An Approver reviews the claim details and supporting receipt reference.
2. Upon approval, the status changes to **APPROVED**.
3. A Finance Manager selects **Disburse Payout**. The system pays the claim and posts a debit to Member Reimbursements and a credit to Cash Clearing in the general ledger.

---

## 8. Automated Recurring Dues

Chamas and associations frequently charge recurring dues (for example, monthly contributions or weekly welfare funds).

### 8.1 Setting up a Schedule
1. Navigate to **Recurring Dues**.
2. Click **New Schedule**.
3. Enter the schedule title, amount per member, billing frequency (Weekly, Monthly, Quarterly, or Annually), and the start date.
4. When active, the system automatically tracks the recurrence cycle.

### 8.2 Triggering a Billing Cycle
- To generate dues immediately for all current members, click **Trigger Cycle Now**.
- The system automatically creates open obligations for all workspace members, logs an audit record, and updates the next scheduled run date.

---

## 9. Payment Methods and Settlement Verification

HESABU verifies transactions through multiple independent rails before funds are credited.

### 9.1 Stellar Network (USDC)
- Payer selects the Stellar rail and receives a unique transaction memo (for example, `HESABU-cmwb3...`).
- The member sends the transfer from their Stellar wallet.
- The verifier validates the transaction directly against the Stellar Horizon API, checking the 64-character transaction hash, finality, memo reference, and destination account.
- Replay protection guarantees that a transaction hash cannot be credited twice.

### 9.2 Safaricom M-Pesa
- Payer enters their Kenyan mobile number (`2547XXXXXXXX`).
- An STK Push prompt is sent directly to their handset to authorize payment with their M-Pesa PIN.
- The payment callback is received and verified by HESABU, confirming the receipt number and amount before settling the obligation.

### 9.3 Development Simulation
- A sandbox simulator is provided for demonstration, testing, and team onboarding without moving live funds.

---

## 10. Autonomous Financial Copilot

HESABU features an interactive Autonomous Financial Copilot available in the **Agentic Copilot** section.

### 10.1 Key Capabilities
- **Natural Language Inquiries**: Ask questions such as:
  - "What is our current treasury cash balance?"
  - "Show all overdue member contributions"
  - "Analyze our spending runway and approved costs"
  - "Are all double-entry ledger accounts balanced?"
- **Automated Health Monitoring**: Detects pending payment anomalies, identifies unreviewed expenses, and audits journal equality.
- **Action Items**: Highlights items that require administrator review.

---

## 11. Accounting and Financial Statements

### 11.1 Double-Entry General Ledger
Every confirmed settlement and payout is recorded in an immutable ledger with balanced debits and credits:
- Cash Clearing (`1000`)
- Stellar USDC (`1010`)
- M-Pesa Float (`1020`)
- Accounts Receivable (`1200`)
- Accounts Payable (`2000`)
- Member Contributions (`4000`)
- Operating Expenses (`5000`)
- Member Reimbursements (`5050`)

### 11.2 Trial Balance
Displays debit and credit totals across all accounts. Confirms that the ledger is mathematically balanced with zero discrepancies.

### 11.3 Income Statement (Profit & Loss)
Shows total recognized member contribution revenue against total operating expenses, calculating the net operating surplus or deficit for the period.

### 11.4 Traceable Journal Reversals
If an erroneous entry must be corrected, HESABU never deletes or silently modifies historical rows. Selecting **Reverse** on an entry generates a balanced reversing counter-entry that explicitly links to the original record with a recorded reason.

---

## 12. Cryptographic Statement Anchors

For governance, audits, and annual general meetings, organizations must prove that historical records were not altered after the fact.

1. Navigate to **Statement Anchors**.
2. Select **Generate Anchor** and choose the audit period window.
3. The platform computes a canonical SHA-256 Merkle root across all journal entries in the window.
4. The generated anchor provides a permanent, tamper-proof mathematical fingerprint that can be shared with external auditors, members, and regulators.
