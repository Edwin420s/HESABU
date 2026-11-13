import { Router } from 'express';
import { statementPdfFormatter } from './statementPdfFormatter.js';
import { generateReceiptVoucher } from './receiptGenerator.js';
import { authenticate, requireWorkspaceRole } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);

/**
 * GET /api/workspaces/:workspaceId/reports/statement/download
 * Download printable financial statement
 */
reportsRouter.get('/workspaces/:workspaceId/reports/statement/download', requireWorkspaceRole, async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { period = 'Current Period', startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [workspace, latestAnchor] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          obligations: {
            where: {
              status: 'SETTLED',
              ...(hasDateFilter ? { updatedAt: dateFilter } : {})
            }
          },
          expenses: {
            where: {
              status: 'PAID',
              ...(hasDateFilter ? { updatedAt: dateFilter } : {})
            }
          },
        },
      }),
      prisma.statementAnchor.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    if (!workspace) throw new AppError('Workspace not found', 404, 'NOT_FOUND');

    const inflows = workspace.obligations.map((o) => ({
      description: o.description || o.title || 'Member Contribution',
      amountMinor: Number(o.amountMinor),
    }));

    const outflows = workspace.expenses.map((e) => ({
      description: e.description || e.title || 'Approved Expense',
      amountMinor: Number(e.amountMinor),
    }));

    const statementText = statementPdfFormatter.formatStatement({
      workspaceName: workspace.name,
      currency: workspace.currency,
      periodLabel: String(period),
      inflows,
      outflows,
      merkleRoot: latestAnchor?.merkleRoot || '',
      sorobanContractId: latestAnchor?.contractAddress || ''
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

    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user.id, workspaceId: payment.workspaceId } }
    });
    if (!membership) throw new AppError('Access denied: workspace membership required', 403, 'FORBIDDEN');

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
