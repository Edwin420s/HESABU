import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  sha256,
  canonicalizeEntry,
  buildMerkleTree,
  verifyMerkleProof
} from '../src/modules/anchors/merkleAnchorService.js';

describe('Merkle Anchor & Cryptographic Audit Verification', () => {
  const sampleEntries = [
    {
      id: 'je_1',
      reference: 'JOURNAL-001',
      description: 'Monthly Chama Contribution',
      postedAt: '2026-03-01T10:00:00.000Z',
      status: 'POSTED',
      lines: [
        { accountCode: '1000-CASH', side: 'DEBIT', amountMinor: 50000n, currency: 'KES' },
        { accountCode: '3000-MEMBER-EQUITY', side: 'CREDIT', amountMinor: 50000n, currency: 'KES' }
      ]
    },
    {
      id: 'je_2',
      reference: 'JOURNAL-002',
      description: 'Welfare Payout',
      postedAt: '2026-03-02T12:00:00.000Z',
      status: 'POSTED',
      lines: [
        { accountCode: '5000-EXPENSE', side: 'DEBIT', amountMinor: 15000n, currency: 'KES' },
        { accountCode: '1000-CASH', side: 'CREDIT', amountMinor: 15000n, currency: 'KES' }
      ]
    },
    {
      id: 'je_3',
      reference: 'JOURNAL-003',
      description: 'Table Banking Loan Repayment',
      postedAt: '2026-03-03T15:30:00.000Z',
      status: 'POSTED',
      lines: [
        { accountCode: '1000-CASH', side: 'DEBIT', amountMinor: 21000n, currency: 'KES' },
        { accountCode: '1200-LOANS-RECEIVABLE', side: 'CREDIT', amountMinor: 20000n, currency: 'KES' },
        { accountCode: '4000-INTEREST-INCOME', side: 'CREDIT', amountMinor: 1000n, currency: 'KES' }
      ]
    }
  ];

  it('canonicalizes journal entries deterministically', () => {
    const entryA = { ...sampleEntries[0], lines: [...sampleEntries[0].lines].reverse() };
    const entryB = sampleEntries[0];
    expect(canonicalizeEntry(entryA)).toBe(canonicalizeEntry(entryB));
  });

  it('builds a binary Merkle tree and produces a 32-byte hex root', () => {
    const leaves = sampleEntries.map(e => sha256(canonicalizeEntry(e)));
    expect(leaves).toHaveLength(3);

    const { root, levels, proofs } = buildMerkleTree(leaves);
    expect(root).toHaveLength(64); // SHA-256 hex string
    expect(levels.length).toBeGreaterThan(0);
    expect(Object.keys(proofs)).toHaveLength(3);
  });

  it('generates valid Merkle inclusion proofs for every leaf', () => {
    const leaves = sampleEntries.map(e => sha256(canonicalizeEntry(e)));
    const { root, proofs } = buildMerkleTree(leaves);

    for (const leafHash of leaves) {
      const proof = proofs[leafHash];
      expect(proof).toBeDefined();

      const isValid = verifyMerkleProof(leafHash, proof, root);
      expect(isValid).toBe(true);
    }
  });

  it('rejects tampered entries or falsified proofs', () => {
    const leaves = sampleEntries.map(e => sha256(canonicalizeEntry(e)));
    const { root, proofs } = buildMerkleTree(leaves);

    const proof = proofs[leaves[0]];

    // Tampered leaf hash
    const fakeLeaf = crypto.createHash('sha256').update('tampered_entry').digest('hex');
    expect(verifyMerkleProof(fakeLeaf, proof, root)).toBe(false);

    // Tampered root
    const fakeRoot = crypto.createHash('sha256').update('fake_root').digest('hex');
    expect(verifyMerkleProof(leaves[0], proof, fakeRoot)).toBe(false);
  });
});
