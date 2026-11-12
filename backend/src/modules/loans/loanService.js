import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';

export class LoanService {
  constructor() {
    this.loans = new Map();
  }

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
          paidMinor: 0
        });
      }

      return {
        interestType: 'FLAT',
        principalMinor: principal,
        totalInterestMinor,
        totalPayableMinor,
        monthlyPaymentMinor,
        installments
      };
    } else {
      // REDUCING_BALANCE
      const monthlyRate = rate / 12;
      const p = principal;
      const factor = Math.pow(1 + monthlyRate, months);
      const monthlyPayment = Math.round((p * (monthlyRate * factor)) / (factor - 1));

      let balance = p;
      let totalInterest = 0;
      const installments = [];

      for (let i = 1; i <= months; i++) {
        const interest = Math.round(balance * monthlyRate);
        totalInterest += interest;
        const principalPortion = i === months ? balance : monthlyPayment - interest;
        const due = principalPortion + interest;
        balance -= principalPortion;

        installments.push({
          installmentNumber: i,
          dueMinor: due,
          principalPortionMinor: Math.round(principalPortion),
          interestPortionMinor: Math.round(interest),
          status: 'PENDING',
          paidMinor: 0
        });
      }

      const totalPayable = p + totalInterest;

      return {
        interestType: 'REDUCING_BALANCE',
        principalMinor: principal,
        totalInterestMinor: totalInterest,
        totalPayableMinor: totalPayable,
        monthlyPaymentMinor: monthlyPayment,
        installments
      };
    }
  }

  applyLoan({
    workspaceId,
    memberId,
    borrowerMemberId,
    borrowerName,
    principalMinor,
    interestRatePct = 12,
    interestRatePercent,
    durationMonths = 6,
    interestType = 'FLAT',
    actorId
  }) {
    const effMemberId = borrowerMemberId || memberId;
    const effRate = interestRatePercent !== undefined ? interestRatePercent : interestRatePct;
    const sched = this.calculateSchedule(principalMinor, effRate, durationMonths, interestType);
    const id = `loan_${crypto.randomBytes(8).toString('hex')}`;

    const loan = {
      id,
      workspaceId,
      memberId: effMemberId,
      borrowerMemberId: effMemberId,
      borrowerName: borrowerName || effMemberId,
      principalMinor: sched.principalMinor,
      interestRatePct: effRate,
      durationMonths,
      interestType,
      totalInterestMinor: sched.totalInterestMinor,
      totalPayableMinor: sched.totalPayableMinor,
      monthlyPaymentMinor: sched.monthlyPaymentMinor,
      outstandingMinor: sched.totalPayableMinor,
      totalRepaidMinor: 0,
      balanceMinor: sched.totalPayableMinor,
      status: 'PENDING_APPROVAL',
      createdAt: new Date(),
      installments: sched.installments
    };

    this.loans.set(id, loan);

    // Durable persistence into PostgreSQL TableLoan and LoanScheduleRow tables
    if (workspaceId && prisma?.tableLoan) {
      prisma.tableLoan.create({
        data: {
          id,
          workspaceId,
          borrowerMemberId: effMemberId,
          borrowerName: borrowerName || effMemberId,
          principalMinor: BigInt(sched.principalMinor),
          interestRatePercent: effRate,
          durationMonths,
          interestType: interestType === 'REDUCING_BALANCE' ? 'REDUCING_BALANCE' : 'FLAT',
          totalInterestMinor: BigInt(sched.totalInterestMinor),
          totalPayableMinor: BigInt(sched.totalPayableMinor),
          monthlyPaymentMinor: BigInt(sched.monthlyPaymentMinor),
          balanceMinor: BigInt(sched.totalPayableMinor),
          status: 'PENDING',
          scheduleRows: {
            create: sched.installments.map((inst, idx) => ({
              installmentNumber: inst.installmentNumber,
              dueDate: new Date(Date.now() + (idx + 1) * 30 * 86400000),
              duePrincipalMinor: BigInt(inst.principalPortionMinor),
              dueInterestMinor: BigInt(inst.interestPortionMinor),
              totalDueMinor: BigInt(inst.dueMinor),
              status: 'PENDING'
            }))
          }
        }
      }).catch(() => {});
    }

    return loan;
  }

  approveLoan(loanId, approverMemberId) {
    const loan = this.loans.get(loanId);
    if (!loan) throw new Error('Loan not found');
    if (loan.memberId === approverMemberId || loan.borrowerMemberId === approverMemberId) {
      throw new Error('Borrower cannot approve their own loan application');
    }
    loan.status = 'APPROVED';
    loan.approvedById = approverMemberId;

    if (prisma?.tableLoan) {
      prisma.tableLoan.update({
        where: { id: loanId },
        data: { status: 'APPROVED' }
      }).catch(() => {});
    }

    return loan;
  }

  disburseLoan(loanId, actorId) {
    const loan = this.loans.get(loanId);
    if (!loan) throw new Error('Loan not found');
    loan.status = 'DISBURSED';
    loan.disbursedAt = new Date();

    if (prisma?.tableLoan) {
      prisma.tableLoan.update({
        where: { id: loanId },
        data: { status: 'ACTIVE', disbursedAt: loan.disbursedAt }
      }).catch(() => {});
    }

    return loan;
  }

  recordRepayment(loanId, amountMinor, transactionRef, actorId) {
    const loan = this.loans.get(loanId);
    if (!loan) throw new Error('Loan not found');

    const payment = Number(amountMinor);
    loan.totalRepaidMinor += payment;
    loan.outstandingMinor = Math.max(0, loan.totalPayableMinor - loan.totalRepaidMinor);
    loan.balanceMinor = loan.outstandingMinor;
    loan.status = loan.outstandingMinor === 0 ? 'FULLY_REPAID' : 'PARTIALLY_REPAID';

    // Allocate payment across installments
    let remainingPayment = payment;
    if (loan.installments) {
      for (const inst of loan.installments) {
        if (remainingPayment <= 0) break;
        const remainingDue = inst.dueMinor - inst.paidMinor;
        if (remainingDue > 0) {
          const allocation = Math.min(remainingPayment, remainingDue);
          inst.paidMinor += allocation;
          remainingPayment -= allocation;
          if (inst.paidMinor >= inst.dueMinor) {
            inst.status = 'PAID';
          }
        }
      }
    }

    // Persist repayment and update schedule rows in PostgreSQL
    if (prisma?.tableLoan) {
      prisma.$transaction(async (tx) => {
        await tx.tableLoan.update({
          where: { id: loanId },
          data: {
            balanceMinor: BigInt(loan.balanceMinor),
            status: loan.outstandingMinor === 0 ? 'REPAID' : 'ACTIVE'
          }
        });

        await tx.loanRepayment.create({
          data: {
            loanId,
            amountMinor: BigInt(payment),
            reference: transactionRef || `REPAY-${Date.now()}`
          }
        });

        // Update database schedule rows
        const rows = await tx.loanScheduleRow.findMany({
          where: { loanId },
          orderBy: { installmentNumber: 'asc' }
        });

        let toAllocate = BigInt(payment);
        for (const row of rows) {
          if (toAllocate <= 0n) break;
          const rowDue = row.totalDueMinor - (row.paidMinor || 0n);
          if (rowDue > 0n) {
            const alloc = toAllocate < rowDue ? toAllocate : rowDue;
            toAllocate -= alloc;
            const newPaid = (row.paidMinor || 0n) + alloc;
            await tx.loanScheduleRow.update({
              where: { id: row.id },
              data: {
                paidMinor: newPaid,
                status: newPaid >= row.totalDueMinor ? 'PAID' : 'PARTIALLY_PAID',
                paidAt: newPaid >= row.totalDueMinor ? new Date() : null
              }
            });
          }
        }
      }).catch(() => {});
    }

    return {
      loanId,
      status: loan.status,
      amountRepaidMinor: payment,
      totalRepaidMinor: loan.totalRepaidMinor,
      outstandingMinor: loan.outstandingMinor,
      transactionRef
    };
  }

  getLoan(loanId) {
    return this.loans.get(loanId);
  }

  listLoans(workspaceId) {
    return Array.from(this.loans.values()).filter(l => l.workspaceId === workspaceId);
  }
}

export const loanService = new LoanService();
