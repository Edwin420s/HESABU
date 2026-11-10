import { Router } from 'express';
import { auditService } from './auditService.js';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';

export const auditRouter = Router();

auditRouter.use(authenticate);

/**
 * GET /api/workspaces/:workspaceId/audit-logs
 * Paginated query of workspace audit trail
 */
auditRouter.get('/workspaces/:workspaceId/audit-logs', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { limit, offset, action } = req.query;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw new AppError('Access denied to workspace audit logs', 403, 'FORBIDDEN');
    }

    const results = await auditService.getAuditLogs(workspaceId, { limit, offset, action });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/workspaces/:workspaceId/audit-logs/export
 * Download CSV compliance export of audit logs
 */
auditRouter.get('/workspaces/:workspaceId/audit-logs/export', async (req, res, next) => {
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

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError('Only workspace Owners and Admins can export compliance audit logs', 403, 'FORBIDDEN');
    }

    const csvData = await auditService.exportCsv(workspaceId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="hesabu_audit_${workspaceId}.csv"`);
    res.send(csvData);
  } catch (err) {
    next(err);
  }
});
