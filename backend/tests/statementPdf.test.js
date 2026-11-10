import { describe, it, expect } from 'vitest';
import { statementPdfFormatter } from '../src/modules/reports/statementPdfFormatter.js';

describe('Financial Statement Formatter & Export Engine', () => {
  it('formats formal statement with inflows, outflows, net surplus, and Merkle root', () => {
    const text = statementPdfFormatter.formatStatement({
      workspaceName: 'Ushirika Cooperative Society',
      currency: 'KES',
      periodLabel: 'Q4 2026',
      inflows: [
        { description: 'Member Dues & Contributions', amountMinor: 25000000 }, // 250k
        { description: 'Table Banking Loan Repayments', amountMinor: 5000000 }, // 50k
      ],
      outflows: [
        { description: 'ROSCA Cycle Round 4 Payout', amountMinor: 15000000 }, // 150k
        { description: 'Auditor & Legal Governance Fees', amountMinor: 3000000 }, // 30k
      ],
      merkleRoot: '593534b8359e1514e37292d265784d67d28ddd1bb9e0cb5fb37c2e0c5a3ffc70',
      sorobanContractId: 'CBZ...TESTNET_ANCHOR',
    });

    expect(text).toContain('HESABU ENTERPRISE FINANCIAL STATEMENT');
    expect(text).toContain('Ushirika Cooperative Society');
    expect(text).toContain('TOTAL INFLOWS:');
    expect(text).toContain('KES 300,000.00');
    expect(text).toContain('TOTAL OUTFLOWS:');
    expect(text).toContain('KES 180,000.00');
    expect(text).toContain('NET OPERATIONAL SURPLUS / (DEFICIT):');
    expect(text).toContain('KES 120,000.00');
    expect(text).toContain('593534b8359e1514e37292d265784d67d28ddd1bb9e0cb5fb37c2e0c5a3ffc70');
    expect(text).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });
});
