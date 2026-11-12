import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Builds a deterministic canonical representation of a journal entry
 */
export function canonicalizeEntry(entry) {
  const sortedLines = [...(entry.lines || [])].sort((a, b) =>
    a.accountCode.localeCompare(b.accountCode) || a.side.localeCompare(b.side)
  );

  const linesStr = sortedLines.map(l =>
    `${l.accountCode}:${l.side}:${l.amountMinor.toString()}:${l.currency}`
  ).join('|');

  return `REF:${entry.reference}|POSTED:${new Date(entry.postedAt).toISOString()}|STATUS:${entry.status}|LINES:${linesStr}`;
}

/**
 * Constructs a real Merkle Tree from an array of leaf hashes
 */
export function buildMerkleTree(leafHashes) {
  if (!leafHashes || leafHashes.length === 0) {
    const emptyRoot = sha256('HESABU_EMPTY_STATEMENT');
    return { root: emptyRoot, levels: [[emptyRoot]], proofs: {} };
  }

  let currentLevel = [...leafHashes];
  const levels = [currentLevel];

  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const combined = sha256(left + right);
      nextLevel.push(combined);
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  const root = levels[levels.length - 1][0];

  // Generate audit inclusion proofs for each leaf
  const proofs = {};
  for (let leafIdx = 0; leafIdx < leafHashes.length; leafIdx++) {
    const proof = [];
    let idx = leafIdx;
    for (let l = 0; l < levels.length - 1; l++) {
      const level = levels[l];
      const isRightSibling = idx % 2 === 1;
      const siblingIdx = isRightSibling ? idx - 1 : (idx + 1 < level.length ? idx + 1 : idx);
      proof.push({
        position: isRightSibling ? 'left' : 'right',
        hash: level[siblingIdx]
      });
      idx = Math.floor(idx / 2);
    }
    proofs[leafHashes[leafIdx]] = proof;
  }

  return { root, levels, proofs };
}

/**
 * Verifies an inclusion proof against a known root
 */
export function verifyMerkleProof(leafHash, proof, rootHash) {
  let current = leafHash;
  for (const step of proof) {
    if (step.position === 'left') {
      current = sha256(step.hash + current);
    } else {
      current = sha256(current + step.hash);
    }
  }
  return current === rootHash;
}

export class MerkleAnchorService {
  /**
   * Generates a canonical statement anchor with Merkle root over a fiscal period
   */
  async generateStatementAnchor({ workspaceId, periodStart, periodEnd, publisherAddress, actorId }) {
    const pStart = new Date(periodStart);
    const pEnd = new Date(periodEnd);

    const entries = await prisma.journalEntry.findMany({
      where: {
        workspaceId,
        postedAt: { gte: pStart, lte: pEnd }
      },
      include: { lines: true },
      orderBy: [
        { postedAt: 'asc' },
        { reference: 'asc' }
      ]
    });

    if (entries.length === 0) {
      throw new AppError('No posted journal entries found in the specified accounting period.', 400);
    }

    // Deterministically canonicalize and compute leaves
    const leaves = entries.map(e => {
      const canonical = canonicalizeEntry(e);
      const hash = sha256(canonical);
      return {
        entryId: e.id,
        reference: e.reference,
        canonical,
        hash
      };
    });

    const leafHashes = leaves.map(l => l.hash);
    const tree = buildMerkleTree(leafHashes);

    const anchor = await prisma.statementAnchor.create({
      data: {
        workspaceId,
        periodStart: pStart,
        periodEnd: pEnd,
        merkleRootHash: tree.root,
        publisherAddress: publisherAddress || 'GBHESABUPUBLISHER1234567890ABCDEFGHIJKLMNOPQRSTUV',
        network: 'testnet',
        status: 'ANCHORED',
        createdById: actorId
      }
    });

    return {
      anchor,
      merkleRoot: tree.root,
      entriesCount: entries.length,
      leavesSummary: leaves.map(l => ({ reference: l.reference, leafHash: l.hash })),
      sampleProof: leaves[0] ? tree.proofs[leaves[0].hash] : null
    };
  }
}

export const merkleAnchorService = new MerkleAnchorService();
