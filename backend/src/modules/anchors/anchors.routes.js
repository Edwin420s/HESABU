import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';
import { asyncHandler, AppError } from '../../shared/errors.js';
import { jsonSafe } from '../../shared/money.js';
import { merkleAnchorService, verifyMerkleProof } from './merkleAnchorService.js';

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

// Generate cryptographic Merkle anchor for a workspace financial period
router.post('/workspaces/:workspaceId/anchors/generate', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN', 'FINANCE_MANAGER', 'AUDITOR'), asyncHandler(async (req, res) => {
  const data = z.object({
    periodStart: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional(),
    publisherAddress: z.string().optional()
  }).parse(req.body);

  const start = data.periodStart ? new Date(data.periodStart) : new Date(Date.now() - 30 * 86400000);
  const end = data.periodEnd ? new Date(data.periodEnd) : new Date();

  const result = await merkleAnchorService.generateStatementAnchor({
    workspaceId: req.params.workspaceId,
    periodStart: start,
    periodEnd: end,
    publisherAddress: data.publisherAddress,
    actorId: req.user.id
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: req.params.workspaceId,
      actorId: req.user.id,
      action: 'STATEMENT_ANCHOR_GENERATED',
      entityType: 'StatementAnchor',
      entityId: result.anchor.id,
      details: { merkleRootHash: result.merkleRoot, entryCount: result.entriesCount }
    }
  });

  res.status(201).json({
    anchor: jsonSafe(result.anchor),
    verifiedEntriesCount: result.entriesCount,
    canonicalHash: result.merkleRoot,
    merkleRoot: result.merkleRoot,
    leavesSummary: result.leavesSummary,
    verificationProof: {
      algorithm: 'SHA-256',
      treeType: 'MERKLE-BINARY-SHA256',
      fingerprint: result.merkleRoot,
      sampleProof: result.sampleProof,
      timestamp: result.anchor.createdAt
    }
  });
}));

// Independent verification of a transaction leaf proof against workspace anchors
router.post('/workspaces/:workspaceId/anchors/verify-leaf', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const { leafHash, proof, rootHash, anchorId } = z.object({
    leafHash: z.string().length(64),
    rootHash: z.string().length(64),
    anchorId: z.string().optional(),
    proof: z.array(z.object({
      position: z.enum(['left', 'right']),
      hash: z.string().length(64)
    }))
  }).parse(req.body);

  const anchor = await prisma.statementAnchor.findFirst({
    where: {
      workspaceId: req.params.workspaceId,
      merkleRoot: rootHash,
      ...(anchorId ? { id: anchorId } : {})
    }
  });

  const isValidProof = verifyMerkleProof(leafHash, proof, rootHash);
  const isRegisteredAnchor = !!anchor;

  res.json({
    verified: isValidProof && isRegisteredAnchor,
    proofValid: isValidProof,
    anchorRegistered: isRegisteredAnchor,
    anchorId: anchor?.id || null,
    network: anchor?.network || null,
    contractAddress: anchor?.contractAddress || null,
    leafHash,
    rootHash,
    proofStepsCount: proof.length
  });
}));

export default router;
