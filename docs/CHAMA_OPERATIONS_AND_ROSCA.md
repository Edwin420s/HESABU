# HESABU Community Finance: ROSCA & Table Banking Operations

## 1. Executive Summary
Traditional informal financial institutions across East Africa—predominantly known as **Chamas**, **Welfare Associations**, and **Investment Clubs**—rely on mutual trust, peer accountability, and rotational savings. HESABU formalizes these community mechanisms into auditable software routines backed by double-entry accounting and cryptographic proof.

---

## 2. Merry-Go-Round / ROSCA Engine
A Rotating Savings and Credit Association (ROSCA) enables members to contribute fixed, periodic sums into a central pool, which is paid out in full to one designated beneficiary each round.

### Lifecycle & Rules:
1. **Cycle Initialization**:
   - Total participating members ($N$).
   - Contribution amount per member per round in integer minor units ($C$).
   - Frequency in days ($D$, e.g. 30 days).
   - Target round pot size:
     $$P = C \times N$$
2. **Scheduled Beneficiary Turn Order**:
   - The cycle establishes a deterministic rotation schedule from Round 1 through Round $N$.
3. **Funding Enforcement**:
   - No round pot may be disbursed until the sum of verified member contributions equals or exceeds $P$.
4. **Disbursement & Turn Advancement**:
   - When the pot is fully funded, the payout is triggered to the beneficiary's registered settlement rail (M-Pesa or Stellar).
   - The round is marked `COMPLETED`, and the engine advances to Round $k + 1$.
   - When all $N$ rounds complete, the cycle transitions to `COMPLETED`.

---

## 3. Table Banking & Peer Lending Engine
Chamas commonly disburse internal micro-loans from pooled savings to members at agreed interest rates.

### Supported Amortization Models:
1. **Flat Interest Rate**:
   - Total interest is computed upfront against the initial principal:
     $$\text{Interest} = \text{Principal} \times \left(\frac{\text{Rate}}{100}\right) \times \left(\frac{\text{Months}}{12}\right)$$
   - Total payable is divided equally across the loan duration.
2. **Reducing Balance Rate**:
   - Monthly interest is calculated strictly on the remaining outstanding principal balance.
   - Principal portions increase monotonically as interest portions decrease over the amortization term.

### Dual-Signoff & Governance:
- **Segregation of Duties**: A borrower is cryptographically prevented from approving their own loan application.
- **Workflow**: `PENDING_APPROVAL` -> `APPROVED` (by Admin/Approver) -> `DISBURSED` -> `PARTIALLY_REPAID` -> `FULLY_REPAID`.
- Every repayment installment generates an immutable receipt reference and updates the double-entry ledger.

---

## 4. Category Budget vs Actual Variance
For formal cooperatives and SMEs, operational discipline requires pre-budgeting organizational expenses.

### Health Status Thresholds:
- **ON_TRACK**: Expenditure is strictly below 80% of category allocation.
- **WARNING**: Expenditure has reached between 80% and 99% of allocation.
- **OVER_BUDGET**: Expenditure has matched or exceeded 100% of allocation.

All actuals are automatically aggregated from approved and paid expense records, eliminating manual bookkeeping discrepancies.
