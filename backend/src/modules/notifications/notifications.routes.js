import { Router } from 'express';
import { notificationService } from '../../services/notificationService.js';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

/**
 * GET /api/workspaces/:workspaceId/notifications
 * List dispatch history for a workspace
 */
notificationsRouter.get('/workspaces/:workspaceId/notifications', async (req, res, next) => {
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
      throw new AppError('Access denied to workspace notifications', 403, 'FORBIDDEN');
    }

    const logs = notificationService.getHistory(workspaceId);
    res.json({
      workspaceId,
      totalCount: logs.length,
      notifications: logs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/workspaces/:workspaceId/notifications/dispatch
 * Trigger an operational alert to a member
 */
notificationsRouter.post('/workspaces/:workspaceId/notifications/dispatch', async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { recipientId, recipientContact, channel, eventType, content, metadata } = req.body;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError('Only workspace Owners and Admins can dispatch notifications', 403, 'FORBIDDEN');
    }

    if (!recipientContact || !channel || !eventType || !content) {
      throw new AppError('recipientContact, channel, eventType, and content are required', 400, 'INVALID_INPUT');
    }

    const logEntry = await notificationService.dispatch({
      workspaceId,
      recipientId,
      recipientContact,
      channel,
      eventType,
      content,
      metadata,
    });

    res.status(201).json(logEntry);
  } catch (err) {
    next(err);
  }
});
