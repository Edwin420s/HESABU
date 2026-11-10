import { Router } from 'express';
import { loanService } from './loanService.js';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';

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
      throw new AppError('Access denied to workspace loans', 403, 'FORBIDDEN');
    }

    const loans = loanService.listLoans(workspaceId);
    res.json({ workspaceId, loans });
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
    const { principalMinor, interestRatePct = 12, durationMonths = 6, interestType = 'FLAT' } = req.body;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw new AppError('Only registered workspace members can apply for loans', 403, 'FORBIDDEN');
    }

    if (!principalMinor || principalMinor <= 0) {
      throw new AppError('principalMinor must be greater than zero', 400, 'INVALID_INPUT');
    }

    const loan = loanService.applyLoan({
      workspaceId,
      memberId: req.user.id,
      principalMinor: Number(principalMinor),
      interestRatePct: Number(interestRatePct),
      durationMonths: Number(durationMonths),
      interestType,
    });

    res.status(201).json(loan);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loans/:loanId/approve
 * Approver / Admin signs off on loan
 */
loanRouter.post('/loans/:loanId/approve', async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const loan = loanService.getLoan(loanId);
    if (!loan) throw new AppError('Loan not found', 404, 'NOT_FOUND');

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId: loan.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN' && membership.role !== 'APPROVER')) {
      throw new AppError('Only Owners, Admins, or Approvers can approve loans', 403, 'FORBIDDEN');
    }

    const updated = loanService.approveLoan(loanId, req.user.id);
    res.json(updated);
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
    const loan = loanService.getLoan(loanId);
    if (!loan) throw new AppError('Loan not found', 404, 'NOT_FOUND');

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId: loan.workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError('Only Owners or Admins can disburse loans', 403, 'FORBIDDEN');
    }

    const updated = loanService.disburseLoan(loanId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/loans/:loanId/repay
 * Settle installment repayment
 */
loanRouter.post('/loans/:loanId/repay', async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { amountMinor, transactionRef } = req.body;

    if (!amountMinor || amountMinor <= 0) {
      throw new AppError('amountMinor must be greater than zero', 400, 'INVALID_INPUT');
    }

    const result = loanService.recordRepayment(loanId, Number(amountMinor), transactionRef);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
