import { describe, it, expect, beforeEach } from 'vitest';
import { LoanService } from '../src/modules/loans/loanService.js';

describe('Table Banking & Peer Lending Loan Engine', () => {
  let loans;

  beforeEach(() => {
    loans = new LoanService();
  });

  it('calculates flat rate amortization schedule accurately', () => {
    // 100,000 KES (10,000,000 minor) at 12% p.a. for 6 months
    // Flat interest: 100,000 * 0.12 * (6/12) = 6,000 KES (600,000 minor)
    // Total payable: 106,000 KES (10,600,000 minor)
    const schedule = loans.calculateSchedule(10000000, 12, 6, 'FLAT');
    expect(schedule.totalInterestMinor).toBe(600000);
    expect(schedule.totalPayableMinor).toBe(10600000);
    expect(schedule.installments.length).toBe(6);
    expect(schedule.monthlyPaymentMinor).toBe(Math.round(10600000 / 6));
  });

  it('calculates reducing balance schedule with declining interest portions', () => {
    const schedule = loans.calculateSchedule(10000000, 12, 6, 'REDUCING_BALANCE');
    expect(schedule.installments.length).toBe(6);
    expect(schedule.totalInterestMinor).toBeLessThan(600000); // Reducing balance produces less interest than flat
    expect(schedule.installments[0].interestPortionMinor).toBeGreaterThan(
      schedule.installments[5].interestPortionMinor
    );
  });

  it('manages full loan lifecycle from application to full settlement', () => {
    const loan = loans.applyLoan({
      workspaceId: 'ws_demo',
      memberId: 'm_borrower_1',
      principalMinor: 5000000, // 50,000 KES
      interestRatePct: 10,
      durationMonths: 4,
      interestType: 'FLAT',
    });

    expect(loan.id).toMatch(/^loan_/);
    expect(loan.status).toBe('PENDING_APPROVAL');

    // Borrower cannot approve own loan
    expect(() => {
      loans.approveLoan(loan.id, 'm_borrower_1');
    }).toThrow('Borrower cannot approve their own loan application');

    // Approver approves
    loans.approveLoan(loan.id, 'm_admin_approver');
    expect(loan.status).toBe('APPROVED');

    // Disburse
    loans.disburseLoan(loan.id);
    expect(loan.status).toBe('DISBURSED');

    // Partial Repayment
    const rep1 = loans.recordRepayment(loan.id, 2000000, 'MPESA_REF_1');
    expect(rep1.status).toBe('PARTIALLY_REPAID');
    expect(rep1.totalRepaidMinor).toBe(2000000);
    expect(rep1.outstandingMinor).toBe(loan.totalPayableMinor - 2000000);

    // Final Repayment
    const rep2 = loans.recordRepayment(loan.id, rep1.outstandingMinor, 'MPESA_REF_2');
    expect(rep2.status).toBe('FULLY_REPAID');
    expect(rep2.outstandingMinor).toBe(0);
  });
});
