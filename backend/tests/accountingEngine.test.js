import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { postingService } from '../src/modules/finance/postingService.js';
import { CHART_OF_ACCOUNTS, isValidAccountCode, assertValidAccountCode } from '../src/modules/finance/chartOfAccounts.js';

describe('Authoritative Chart of Accounts & Central Double-Entry Posting Engine', () => {
  let token = '';
  let workspaceId = '';

  beforeAll(async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Chief Accountant',
      email: `chief_accountant_${Date.now()}@hesabu.test`,
      password: 'HesabuSecurePassword!2026',
    });
    token = regRes.body.token;

    const wsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Enterprise Audit Workspace',
        type: 'GROUP',
        currency: 'KES',
      });
    workspaceId = wsRes.body.workspace.id;
  });

  it('validates official Chart of Accounts codes and rejects invalid arbitrary text', () => {
    expect(isValidAccountCode('1000-CASH-CLEARING')).toBe(true);
    expect(isValidAccountCode('2100-CONTRIBUTIONS-PAYABLE')).toBe(true);
    expect(isValidAccountCode('4000-REVENUE')).toBe(true);
    expect(isValidAccountCode('5050-MEMBER-REIMBURSEMENTS')).toBe(true);

    expect(isValidAccountCode('UNKNOWN_RANDOM_ACCOUNT')).toBe(false);
    expect(isValidAccountCode('foobar')).toBe(false);
    expect(() => assertValidAccountCode('bad-code')).toThrow('Invalid Chart of Accounts code');
  });

  it('posts a balanced double-entry journal entry via central postingService', async () => {
    const entry = await postingService.postEntry({
      workspaceId,
      reference: `TEST-JOURNAL-${Date.now()}`,
      description: 'Capital contribution from founders',
      lines: [
        { accountCode: '1000-CASH-CLEARING', side: 'DEBIT', amountMinor: 5000000n, currency: 'KES' },
        { accountCode: '3100-MEMBER-CAPITAL', side: 'CREDIT', amountMinor: 5000000n, currency: 'KES' }
      ]
    });

    expect(entry.id).toBeDefined();
    expect(entry.status).toBe('POSTED');
    expect(entry.lines.length).toBe(2);
  });

  it('strictly rejects out-of-balance journal entries', async () => {
    await expect(
      postingService.postEntry({
        workspaceId,
        reference: `UNBALANCED-${Date.now()}`,
        description: 'Imbalanced entry',
        lines: [
          { accountCode: '1000-CASH-CLEARING', side: 'DEBIT', amountMinor: 5000000n, currency: 'KES' },
          { accountCode: '3100-MEMBER-CAPITAL', side: 'CREDIT', amountMinor: 4000000n, currency: 'KES' }
        ]
      })
    ).rejects.toThrow(/out of balance for currency KES/);
  });

  it('strictly rejects entries with unauthorized or invalid account codes', async () => {
    await expect(
      postingService.postEntry({
        workspaceId,
        reference: `BAD-ACCOUNT-${Date.now()}`,
        description: 'Entry with fake account',
        lines: [
          { accountCode: 'INVALID-CODE', side: 'DEBIT', amountMinor: 1000000n, currency: 'KES' },
          { accountCode: '1000-CASH-CLEARING', side: 'CREDIT', amountMinor: 1000000n, currency: 'KES' }
        ]
      })
    ).rejects.toThrow(/Invalid Chart of Accounts code/);
  });

  it('reverses a posted journal entry with an exact GAAP contra-entry', async () => {
    const original = await postingService.postEntry({
      workspaceId,
      reference: `ORIGINAL-TO-REVERSE-${Date.now()}`,
      description: 'Original fee accrual',
      lines: [
        { accountCode: '1200-ACCOUNTS-RECEIVABLE', side: 'DEBIT', amountMinor: 250000n, currency: 'KES' },
        { accountCode: '4100-SERVICE-FEES', side: 'CREDIT', amountMinor: 250000n, currency: 'KES' }
      ]
    });

    const reversal = await postingService.reverseEntry({
      journalEntryId: original.id,
      reason: 'Billed in error'
    });

    expect(reversal.reference).toBe(`REV-${original.reference}`);
    const debitLine = reversal.lines.find(l => l.side === 'DEBIT');
    const creditLine = reversal.lines.find(l => l.side === 'CREDIT');

    // Original DEBIT was 1200, so reversal DEBIT must be 4100
    expect(debitLine.accountCode).toBe('4100-SERVICE-FEES');
    expect(creditLine.accountCode).toBe('1200-ACCOUNTS-RECEIVABLE');
  });
});
