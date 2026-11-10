import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../shared/errors.js';

export const invitationsRouter = Router();

// Store temporary invitation tokens (in-memory token registry for workspace onboarding)
const invitationTokens = new Map();

/**
 * POST /api/workspaces/:workspaceId/invitations
 * Creates a signed invitation link with a 7-day cryptographic token
 */
invitationsRouter.post('/workspaces/:workspaceId/invitations', authenticate, async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const { email, role = 'MEMBER' } = req.body;

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId: req.user.id,
        },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new AppError('Only workspace Owners and Admins can generate invitations', 403, 'FORBIDDEN');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const inviteRecord = {
      token,
      workspaceId,
      email: email ? email.toLowerCase() : null,
      role,
      createdBy: req.user.id,
      expiresAt,
    };

    invitationTokens.set(token, inviteRecord);

    res.status(201).json({
      invitationToken: token,
      role,
      expiresAt: expiresAt.toISOString(),
      inviteLink: `/join?token=${token}`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/invitations/:token/verify
 * Verifies an invitation token
 */
invitationsRouter.get('/invitations/:token/verify', async (req, res, next) => {
  try {
    const { token } = req.params;
    const invite = invitationTokens.get(token);

    if (!invite || new Date() > invite.expiresAt) {
      throw new AppError('Invitation token is invalid or has expired', 404, 'NOT_FOUND');
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: invite.workspaceId },
      select: { id: true, name: true, type: true, currency: true },
    });

    res.json({
      valid: true,
      workspace,
      role: invite.role,
      invitedEmail: invite.email,
    });
  } catch (err) {
    next(err);
  }
});
