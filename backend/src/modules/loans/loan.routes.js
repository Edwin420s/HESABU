import { Router } from 'express';
import { loanService } from './loanService.js';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { jsonSafe } from '../../shared/money.js';

export const loanRouter = Router();

loanRouter.use(authenticate);

/**
 * GET /api/workspaces/:workspaceId/loans
 * List loans for a workspace
 */
loanRouter.get('/workspaces/:workspaceId/loans', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw new AppError('Access denied to workspace loans.', 403, 'FORBIDDEN');
    }

    const loans = await loanService.listLoans(workspaceId);
    res.json({ workspaceId, loans: jsonSafe(loans) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:workspaceId/loans/apply
 * Apply for a Chama/SME table loan
 */
loanRouter.post('/workspaces/:workspaceId/loans/apply', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { principalMinor, interestRatePct = 12, durationMonths = 6, interestType = 'FLAT', borrowerName } = req.body;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
      include: { user: true }
    });

    if (!membership) {
      throw new AppError('Only registered workspace members can apply for loans.', 403, 'FORBIDDEN');
    }

    if (!principalMinor || BigInt(principalMinor) <= 0n) {
      throw new AppError('principalMinor must be greater than zero.', 400, 'INVALID_INPUT');
    }

    const loan = await loanService.applyLoan({
      workspaceId,
      borrowerMemberId: membership.id,
      borrowerName: borrowerName || membership.user.name,
      principalMinor,
      interestRatePercent: interestRatePct,
      durationMonths,
      interestType,
      actorId: req.user.id
    });

    res.status(201).json(jsonSafe(loan));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loans/:loanId/approve
 * Approve loan application
 */
loanRouter.post('/loans/:loanId/approve', async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const loan = await loanService.getLoan(loanId);

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId: loan.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
      throw new AppError('Only Owners, Admins, or Finance Managers can approve loans.', 403, 'FORBIDDEN');
    }

    const updated = await loanService.approveLoan(loanId, membership.id);
    res.json(jsonSafe(updated));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loans/:loanId/disburse
 * Disburse principal to borrower
 */
loanRouter.post('/loans/:loanId/disburse', async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const loan = await loanService.getLoan(loanId);

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId: loan.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || !['OWNER', 'ADMIN', 'FINANCE_MANAGER'].includes(membership.role)) {
      throw new AppError('Only Owners, Admins, or Finance Managers can disburse loans.', 403, 'FORBIDDEN');
    }

    const updated = await loanService.disburseLoan(loanId, req.user.id);
    res.json(jsonSafe(updated));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loans/:loanId/repay
 * Settle installment repayment with workspace membership authorization
 */
loanRouter.post('/loans/:loanId/repay', async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { amountMinor, transactionRef } = req.body;

    const loan = await loanService.getLoan(loanId);
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId: loan.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw new AppError('Access denied: you must be a workspace member to record a loan repayment.', 403, 'FORBIDDEN');
    }

    if (!amountMinor || BigInt(amountMinor) <= 0n) {
      throw new AppError('amountMinor must be greater than zero.', 400, 'INVALID_INPUT');
    }

    const result = await loanService.recordRepayment(loanId, amountMinor, transactionRef, req.user.id);
    res.json(jsonSafe(result));
  } catch (err) {
    next(err);
  }
});
