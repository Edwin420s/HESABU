import crypto from 'crypto';

export class LoanService {
  constructor() {
    this.loans = new Map();
  }

  /**
   * Calculate amortization schedule in integer minor units
   */
  calculateSchedule(principalMinor, interestRatePct, durationMonths, interestType = 'FLAT') {
    const principal = Number(principalMinor);
    const rate = Number(interestRatePct) / 100;
    const months = Number(durationMonths);

    if (principal <= 0 || months <= 0) {
      throw new Error('Principal and duration must be greater than zero');
    }

    if (interestType === 'FLAT') {
      const totalInterestMinor = Math.round(principal * rate * (months / 12));
      const totalPayableMinor = principal + totalInterestMinor;
      const monthlyPaymentMinor = Math.round(totalPayableMinor / months);

      const installments = [];
      let runningBalance = totalPayableMinor;

      for (let i = 1; i <= months; i++) {
        const payment = i === months ? runningBalance : monthlyPaymentMinor;
        runningBalance -= payment;
        installments.push({
          installmentNumber: i,
          dueMinor: payment,
          principalPortionMinor: Math.round(principal / months),
          interestPortionMinor: Math.round(totalInterestMinor / months),
          status: 'PENDING',
          paidMinor: 0,
        });
      }

      return {
        interestType: 'FLAT',
        principalMinor: principal,
        totalInterestMinor,
        totalPayableMinor,
        monthlyPaymentMinor,
        installments,
      };
    } else {
      // REDUCING_BALANCE
      const monthlyRate = rate / 12;
      const monthlyPayment =
        monthlyRate === 0
          ? principal / months
          : (principal * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
            (Math.pow(1 + monthlyRate, months) - 1);

      let remainingPrincipal = principal;
      let totalInterestMinor = 0;
      const installments = [];

      for (let i = 1; i <= months; i++) {
        const interestMinor = Math.round(remainingPrincipal * monthlyRate);
        const principalMinorPart = Math.round(monthlyPayment - interestMinor);
        remainingPrincipal -= principalMinorPart;
        totalInterestMinor += interestMinor;

        installments.push({
          installmentNumber: i,
          dueMinor: interestMinor + principalMinorPart,
          principalPortionMinor: principalMinorPart,
          interestPortionMinor: interestMinor,
          status: 'PENDING',
          paidMinor: 0,
        });
      }

      return {
        interestType: 'REDUCING_BALANCE',
        principalMinor: principal,
        totalInterestMinor,
        totalPayableMinor: principal + totalInterestMinor,
        monthlyPaymentMinor: Math.round(monthlyPayment),
        installments,
      };
    }
  }

  /**
   * Apply for a table banking / chama loan
   */
  applyLoan({ workspaceId, memberId, principalMinor, interestRatePct = 12, durationMonths = 6, interestType = 'FLAT' }) {
    const id = `loan_${crypto.randomBytes(12).toString('hex')}`;
    const schedule = this.calculateSchedule(principalMinor, interestRatePct, durationMonths, interestType);

    const loan = {
      id,
      workspaceId,
      memberId,
      status: 'PENDING_APPROVAL',
      ...schedule,
      totalRepaidMinor: 0,
      outstandingMinor: schedule.totalPayableMinor,
      repayments: [],
      approvedBy: null,
      disbursedAt: null,
      createdAt: new Date(),
    };

    this.loans.set(id, loan);
    return loan;
  }

  /**
   * Approve loan
   */
  approveLoan(loanId, approverId) {
    const loan = this.loans.get(loanId);
    if (!loan) throw new Error(`Loan ${loanId} not found`);

    if (loan.memberId === approverId) {
      throw new Error('Borrower cannot approve their own loan application');
    }

    loan.status = 'APPROVED';
    loan.approvedBy = approverId;
    loan.approvedAt = new Date();
    return loan;
  }

  /**
   * Disburse approved loan
   */
  disburseLoan(loanId) {
    const loan = this.loans.get(loanId);
    if (!loan) throw new Error(`Loan ${loanId} not found`);
    if (loan.status !== 'APPROVED') {
      throw new Error('Only approved loans can be disbursed');
    }

    loan.status = 'DISBURSED';
    loan.disbursedAt = new Date();
    return loan;
  }

  /**
   * Record a loan repayment
   */
  recordRepayment(loanId, amountMinor, transactionRef = '') {
    const loan = this.loans.get(loanId);
    if (!loan) throw new Error(`Loan ${loanId} not found`);
    if (loan.status !== 'DISBURSED' && loan.status !== 'PARTIALLY_REPAID') {
      throw new Error(`Cannot accept repayment for loan in ${loan.status} status`);
    }

    const paid = Number(amountMinor);
    if (paid <= 0) throw new Error('Repayment amount must be positive');

    loan.totalRepaidMinor += paid;
    loan.outstandingMinor = Math.max(0, loan.totalPayableMinor - loan.totalRepaidMinor);

    loan.repayments.push({
      id: `rep_${crypto.randomBytes(8).toString('hex')}`,
      amountMinor: paid,
      transactionRef,
      timestamp: new Date(),
    });

    if (loan.outstandingMinor === 0) {
      loan.status = 'FULLY_REPAID';
    } else {
      loan.status = 'PARTIALLY_REPAID';
    }

    return {
      loanId,
      paidMinor: paid,
      totalRepaidMinor: loan.totalRepaidMinor,
      outstandingMinor: loan.outstandingMinor,
      status: loan.status,
    };
  }

  /**
   * List loans for workspace
   */
  listLoans(workspaceId) {
    return Array.from(this.loans.values()).filter((l) => l.workspaceId === workspaceId);
  }

  /**
   * Get loan by ID
   */
  getLoan(loanId) {
    return this.loans.get(loanId) || null;
  }
}

export const loanService = new LoanService();
