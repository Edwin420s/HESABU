import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/errors.js';
import { jsonSafe } from '../../shared/money.js';

const router = Router();
router.use(authenticate);

// List statement anchors
router.get('/workspaces/:workspaceId/anchors', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const anchors = await prisma.statementAnchor.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ anchors: jsonSafe(anchors) });
}));

// Generate cryptographic anchor for a workspace financial period
router.post('/workspaces/:workspaceId/anchors/generate', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER', 'AUDITOR'), asyncHandler(async (req, res) => {
  const data = z.object({
    periodStart: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional()
  }).parse(req.body);

  const start = data.periodStart ? new Date(data.periodStart) : new Date(Date.now() - 30 * 86400000);
  const end = data.periodEnd ? new Date(data.periodEnd) : new Date();

  const entries = await prisma.journalEntry.findMany({
    where: {
      workspaceId: req.params.workspaceId,
      postedAt: { gte: start, lte: end }
    },
    include: { lines: true },
    orderBy: { postedAt: 'asc' }
  });

  // Calculate canonical SHA-256 commitment
  const canonicalData = entries.map(e => ({
    id: e.id,
    ref: e.reference,
    time: e.postedAt.toISOString(),
    lines: e.lines.map(l => `${l.accountCode}:${l.side}:${l.amountMinor.toString()}:${l.currency}`).join('|')
  }));

  const payload = JSON.stringify(canonicalData);
  const merkleRootHash = createHash('sha256').update(payload).digest('hex');

  const anchor = await prisma.statementAnchor.create({
    data: {
      workspaceId: req.params.workspaceId,
      periodStart: start,
      periodEnd: end,
      merkleRootHash,
      network: env.STELLAR_NETWORK,
      createdById: req.user.id
    }
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: req.params.workspaceId,
      actorId: req.user.id,
      action: 'STATEMENT_ANCHOR_GENERATED',
      entityType: 'StatementAnchor',
      entityId: anchor.id,
      details: { merkleRootHash, entryCount: entries.length }
    }
  });

  res.status(201).json({
    anchor: jsonSafe(anchor),
    verifiedEntriesCount: entries.length,
    canonicalHash: merkleRootHash,
    verificationProof: {
      algorithm: 'SHA-256',
      fingerprint: merkleRootHash,
      timestamp: anchor.createdAt
    }
  });
}));

export default router;
