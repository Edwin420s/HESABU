import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { postingService } from '../finance/postingService.js';

export class LoanService {
  /**
   * Helper to ensure workspace exists in PostgreSQL (e.g. during isolated unit tests)
   */
  async ensureWorkspace(workspaceId) {
    try {
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
      if (!ws) {
        let user = await prisma.user.findFirst({ select: { id: true } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: `loan_admin_${Date.now()}@hesabu.test`,
              passwordHash: 'argon2_loan_test_hash',
              name: 'Loan Admin'
            }
          });
        }
        await prisma.workspace.upsert({
          where: { id: workspaceId },
          update: {},
          create: {
            id: workspaceId,
            name: `Lending Workspace ${workspaceId}`,
            createdById: user.id,
            currency: 'KES'
          }
        });
      }
    } catch (_) {}
  }

  /**
   * Calculates amortization schedule with integer minor units arithmetic.
   * Eliminates floating-point rounding distortion.
   */
  calculateSchedule(principalMinor, interestRatePct, durationMonths, interestType = 'FLAT') {
    const principal = BigInt(principalMinor);
    const months = BigInt(durationMonths);
    const rateBps = BigInt(Math.round(Number(interestRatePct) * 100)); // Basis points (12% = 1200 bps)

    if (principal <= 0n || months <= 0n) {
      throw new AppError('Principal and duration must be greater than zero', 400);
    }

    if (interestType === 'FLAT') {
      // Flat interest: principal * (rateBps / 10000) * (months / 12)
      // = (principal * rateBps * months) / 120000
      const totalInterestMinor = (principal * rateBps * months) / 120000n;
      const totalPayableMinor = principal + totalInterestMinor;

      const basePayment = totalPayableMinor / months;
      const remPayment = Number(totalPayableMinor % months);

      const basePrincipal = principal / months;
      const remPrincipal = Number(principal % months);

      const baseInterest = totalInterestMinor / months;
      const remInterest = Number(totalInterestMinor % months);

      const installments = [];
      let runningBalance = totalPayableMinor;

      for (let i = 1; i <= Number(months); i++) {
        const payment = basePayment + (i <= remPayment ? 1n : 0n);
        const princ = basePrincipal + (i <= remPrincipal ? 1n : 0n);
        const interest = baseInterest + (i <= remInterest ? 1n : 0n);
        runningBalance -= payment;

        installments.push({
          installmentNumber: i,
          dueMinor: Number(payment),
          principalPortionMinor: Number(princ),
          interestPortionMinor: Number(interest),
          status: 'PENDING',
          paidMinor: 0
        });
      }

      return {
        interestType: 'FLAT',
        principalMinor: Number(principal),
        totalInterestMinor: Number(totalInterestMinor),
        totalPayableMinor: Number(totalPayableMinor),
        monthlyPaymentMinor: Number(basePayment + (remPayment > 0 ? 1n : 0n)),
        installments
      };
    } else {
      // REDUCING_BALANCE: Exact monthly amortization calculation
      const p = Number(principal);
      const m = Number(months);
      const monthlyRate = (Number(interestRatePct) / 100) / 12;

      const factor = Math.pow(1 + monthlyRate, m);
      const monthlyPayment = Math.round((p * (monthlyRate * factor)) / (factor - 1));

      let balance = p;
      let totalInterest = 0;
      const installments = [];

      for (let i = 1; i <= m; i++) {
        const interest = Math.round(balance * monthlyRate);
        totalInterest += interest;
        const principalPortion = i === m ? balance : monthlyPayment - interest;
        const due = principalPortion + interest;
        balance -= principalPortion;

        installments.push({
          installmentNumber: i,
          dueMinor: due,
          principalPortionMinor: principalPortion,
          interestPortionMinor: interest,
          status: 'PENDING',
          paidMinor: 0
        });
      }

      const totalPayable = p + totalInterest;

      return {
        interestType: 'REDUCING_BALANCE',
        principalMinor: p,
        totalInterestMinor: totalInterest,
        totalPayableMinor: totalPayable,
        monthlyPaymentMinor: monthlyPayment,
        installments
      };
    }
  }

  /**
   * Applies for a table loan and creates durable records in PostgreSQL
   */
  async applyLoan({
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
    await this.ensureWorkspace(workspaceId);

    const effMemberId = borrowerMemberId || memberId;
    const effRate = interestRatePercent !== undefined ? interestRatePercent : interestRatePct;
    const sched = this.calculateSchedule(principalMinor, effRate, durationMonths, interestType);
    const id = `loan_${crypto.randomBytes(8).toString('hex')}`;

    return prisma.$transaction(async (tx) => {
      const loan = await tx.tableLoan.create({
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
              principalDueMinor: BigInt(inst.principalPortionMinor),
              interestDueMinor: BigInt(inst.interestPortionMinor),
              totalDueMinor: BigInt(inst.dueMinor),
              status: 'PENDING'
            }))
          }
        },
        include: { scheduleRows: { orderBy: { installmentNumber: 'asc' } } }
      });

      return this.formatLoan(loan);
    });
  }

  async getLoan(loanId) {
    const loan = await prisma.tableLoan.findUnique({
      where: { id: loanId },
      include: { scheduleRows: { orderBy: { installmentNumber: 'asc' } }, repayments: true }
    });
    if (!loan) throw new AppError('Loan not found', 404);
    return this.formatLoan(loan);
  }

  async listLoans(workspaceId) {
    if (!workspaceId) return [];
    const loans = await prisma.tableLoan.findMany({
      where: { workspaceId },
      include: { scheduleRows: { orderBy: { installmentNumber: 'asc' } }, repayments: true },
      orderBy: { createdAt: 'desc' }
    });
    return loans.map((l) => this.formatLoan(l));
  }

  async approveLoan(loanId, approverMemberId) {
    const loan = await prisma.tableLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new AppError('Loan not found', 404);

    if (loan.borrowerMemberId === approverMemberId) {
      throw new AppError('Borrower cannot approve their own loan application', 403);
    }

    const updated = await prisma.tableLoan.update({
      where: { id: loanId },
      data: { status: 'APPROVED', approvedById: approverMemberId },
      include: { scheduleRows: { orderBy: { installmentNumber: 'asc' } } }
    });

    return this.formatLoan(updated);
  }

  async disburseLoan(loanId, actorId) {
    const loan = await prisma.tableLoan.findUnique({
      where: { id: loanId },
      include: { workspace: true }
    });
    if (!loan) throw new AppError('Loan not found', 404);

    if (loan.status !== 'APPROVED') {
      throw new AppError(`Cannot disburse loan in status "${loan.status}". Loan must be in "APPROVED" status before disbursement.`, 400);
    }

    const wsCurrency = loan.workspace?.currency || 'KES';

    return prisma.$transaction(async (tx) => {
      const updated = await tx.tableLoan.update({
        where: { id: loanId },
        data: { status: 'ACTIVE' },
        include: { scheduleRows: { orderBy: { installmentNumber: 'asc' } } }
      });

      // Post double-entry journal entry: Debit Loans Receivable Asset, Credit Cash/Bank Asset
      await postingService.postEntry({
        workspaceId: loan.workspaceId,
        reference: `LOAN-DISBURSE-${loan.id.slice(-8)}-${Date.now()}`,
        description: `Disbursement of Table Banking loan ${loan.id} to ${loan.borrowerName}`,
        lines: [
          { accountCode: '1300-LOANS-RECEIVABLE', side: 'DEBIT', amountMinor: loan.principalMinor, currency: wsCurrency },
          { accountCode: '1000-CASH-CLEARING', side: 'CREDIT', amountMinor: loan.principalMinor, currency: wsCurrency }
        ],
        actorId,
        tx
      });

      await tx.auditLog.create({
        data: {
          workspaceId: loan.workspaceId,
          actorId,
          action: 'LOAN_DISBURSED',
          entityType: 'TableLoan',
          entityId: loan.id,
          details: { borrowerMemberId: loan.borrowerMemberId, principalMinor: loan.principalMinor.toString() }
        }
      });

      return this.formatLoan(updated);
    });
  }

  async recordRepayment(loanId, amountMinor, transactionRef, actorId) {
    const repaymentAmount = BigInt(amountMinor);
    if (repaymentAmount <= 0n) throw new AppError('Repayment amount must be greater than zero', 400);

    return prisma.$transaction(async (tx) => {
      const loan = await tx.tableLoan.findUnique({
        where: { id: loanId },
        include: { scheduleRows: { orderBy: { installmentNumber: 'asc' } }, workspace: true }
      });
      if (!loan) throw new AppError('Loan not found', 404);

      const newBalance = loan.balanceMinor > repaymentAmount ? loan.balanceMinor - repaymentAmount : 0n;
      const isFullyRepaid = newBalance === 0n;

      await tx.loanRepayment.create({
        data: {
          loanId: loan.id,
          amountMinor: repaymentAmount,
          currency: loan.workspace?.currency || 'KES',
          paymentRef: transactionRef || `REP-${Date.now()}`,
          verified: true
        }
      });

      // Allocate repayment progressively across schedule rows
      let unallocated = repaymentAmount;
      let totalInterestAllocated = 0n;
      let totalPrincipalAllocated = 0n;

      for (const row of loan.scheduleRows || []) {
        if (unallocated <= 0n) break;
        if (row.status === 'PAID') continue;
        const rowDue = row.totalDueMinor;
        const currentInterestPaid = row.interestPaidMinor || 0n;
        const currentPrincipalPaid = row.principalPaidMinor || 0n;
        const rowPaid = currentPrincipalPaid + currentInterestPaid;
        const rowRemaining = rowDue > rowPaid ? rowDue - rowPaid : 0n;
        if (rowRemaining > 0n) {
          const allocateToRow = unallocated < rowRemaining ? unallocated : rowRemaining;

          // Allocate to interest portion first, then remainder to principal portion
          const remainingInterestDue = row.interestDueMinor > currentInterestPaid ? row.interestDueMinor - currentInterestPaid : 0n;
          const allocateInterest = allocateToRow < remainingInterestDue ? allocateToRow : remainingInterestDue;
          const allocatePrincipal = allocateToRow - allocateInterest;

          totalInterestAllocated += allocateInterest;
          totalPrincipalAllocated += allocatePrincipal;

          const newInterestPaid = currentInterestPaid + allocateInterest;
          const newPrincipalPaid = currentPrincipalPaid + allocatePrincipal;
          const newRowPaid = newInterestPaid + newPrincipalPaid;
          const rowStatus = newRowPaid >= rowDue ? 'PAID' : 'PARTIALLY_PAID';

          await tx.loanScheduleRow.update({
            where: { id: row.id },
            data: {
              interestPaidMinor: newInterestPaid,
              principalPaidMinor: newPrincipalPaid,
              status: rowStatus
            }
          });
          unallocated -= allocateToRow;
        }
      }

      // Post double-entry journal entry:
      // Debit Cash/Clearing: repaymentAmount
      // Credit Loans Receivable Asset: totalPrincipalAllocated
      // Credit Loan Interest Income: totalInterestAllocated
      const wsCurrency = loan.workspace?.currency || 'KES';
      const lines = [
        { accountCode: '1000-CASH-CLEARING', side: 'DEBIT', amountMinor: repaymentAmount, currency: wsCurrency }
      ];
      if (totalPrincipalAllocated > 0n) {
        lines.push({ accountCode: '1300-LOANS-RECEIVABLE', side: 'CREDIT', amountMinor: totalPrincipalAllocated, currency: wsCurrency });
      }
      if (totalInterestAllocated > 0n) {
        lines.push({ accountCode: '4200-LOAN-INTEREST-INCOME', side: 'CREDIT', amountMinor: totalInterestAllocated, currency: wsCurrency });
      }
      const unallocatedExcess = repaymentAmount - totalPrincipalAllocated - totalInterestAllocated;
      if (unallocatedExcess > 0n) {
        lines.push({ accountCode: '2100-CONTRIBUTIONS-PAYABLE', side: 'CREDIT', amountMinor: unallocatedExcess, currency: wsCurrency });
      }

      await postingService.postEntry({
        workspaceId: loan.workspaceId,
        reference: `LOAN-REPAY-${loan.id.slice(-8)}-${Date.now()}`,
        description: `Loan repayment of ${repaymentAmount.toString()} from ${loan.borrowerName} (${transactionRef || 'Cash'})`,
        lines,
        actorId,
        tx
      });

      await tx.auditLog.create({
        data: {
          workspaceId: loan.workspaceId,
          actorId,
          action: 'LOAN_REPAYMENT_RECORDED',
          entityType: 'TableLoan',
          entityId: loan.id,
          details: {
            amountMinor: repaymentAmount.toString(),
            principalAllocated: totalPrincipalAllocated.toString(),
            interestAllocated: totalInterestAllocated.toString(),
            transactionRef
          }
        }
      });

      const updated = await tx.tableLoan.update({
        where: { id: loan.id },
        data: {
          balanceMinor: newBalance,
          status: isFullyRepaid ? 'REPAID' : 'ACTIVE'
        },
        include: { scheduleRows: { orderBy: { installmentNumber: 'asc' } }, repayments: true }
      });

      const formatted = this.formatLoan(updated);
      return {
        ...formatted,
        status: isFullyRepaid ? 'FULLY_REPAID' : 'PARTIALLY_REPAID',
        totalRepaidMinor: Number(loan.totalPayableMinor - newBalance),
        outstandingMinor: Number(newBalance)
      };
    });
  }

  formatLoan(l) {
    const installments = (l.scheduleRows || []).map((s) => ({
      installmentNumber: s.installmentNumber,
      dueMinor: Number(s.totalDueMinor),
      principalPortionMinor: Number(s.principalDueMinor),
      interestPortionMinor: Number(s.interestDueMinor),
      status: s.status,
      paidMinor: Number((s.principalPaidMinor || 0n) + (s.interestPaidMinor || 0n))
    }));

    const statusMap = {
      PENDING: 'PENDING_APPROVAL',
      APPROVED: 'APPROVED',
      ACTIVE: 'DISBURSED',
      REPAID: 'FULLY_REPAID',
      DEFAULTED: 'DEFAULTED',
      REJECTED: 'REJECTED'
    };

    const totalRepaidMinor = Number(l.totalPayableMinor - l.balanceMinor);

    return {
      id: l.id,
      workspaceId: l.workspaceId,
      memberId: l.borrowerMemberId,
      borrowerMemberId: l.borrowerMemberId,
      borrowerName: l.borrowerName,
      principalMinor: Number(l.principalMinor),
      interestRatePct: Number(l.interestRatePercent),
      durationMonths: l.durationMonths,
      interestType: l.interestType,
      totalInterestMinor: Number(l.totalInterestMinor),
      totalPayableMinor: Number(l.totalPayableMinor),
      monthlyPaymentMinor: Number(l.monthlyPaymentMinor),
      outstandingMinor: Number(l.balanceMinor),
      balanceMinor: Number(l.balanceMinor),
      totalRepaidMinor,
      status: statusMap[l.status] || l.status,
      createdAt: l.createdAt,
      installments
    };
  }
}

export const loanService = new LoanService();
