import { Router } from 'express';
import { statementPdfFormatter } from './statementPdfFormatter.js';
import { generateReceiptVoucher } from './receiptGenerator.js';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

/**
 * GET /api/workspaces/:workspaceId/reports/statement/download
 * Download printable financial statement
 */
reportsRouter.get('/workspaces/:workspaceId/reports/statement/download', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { period = 'Current Period' } = req.query;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        obligations: { where: { status: 'SETTLED' } },
        expenses: { where: { status: 'PAID' } },
      },
    });

    if (!workspace) throw new AppError('Workspace not found', 404, 'NOT_FOUND');

    const inflows = workspace.obligations.map((o) => ({
      description: o.description || 'Member Contribution',
      amountMinor: Number(o.amountMinor),
    }));

    const outflows = workspace.expenses.map((e) => ({
      description: e.description || 'Approved Expense',
      amountMinor: Number(e.amountMinor),
    }));

    const statementText = statementPdfFormatter.formatStatement({
      workspaceName: workspace.name,
      currency: workspace.currency,
      periodLabel: String(period),
      inflows,
      outflows,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hesabu_statement_${workspaceId}.txt"`);
    res.send(statementText);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/:paymentId/voucher
 * Retrieve payment receipt voucher
 */
reportsRouter.get('/payments/:paymentId/voucher', async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: {
        obligation: { include: { member: true } },
        workspace: true,
      },
    });

    if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');

    const voucher = generateReceiptVoucher({
      paymentId: payment.id,
      receiptNumber: payment.providerRef || `REC-${payment.id.slice(-6).toUpperCase()}`,
      workspaceName: payment.workspace.name,
      memberName: payment.obligation?.member?.name || payment.obligation?.member?.email || 'Member',
      amountMinor: Number(payment.amountMinor),
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      timestamp: payment.createdAt,
    });

    res.json(voucher);
  } catch (err) {
    next(err);
  }
});
