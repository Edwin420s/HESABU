import crypto from 'crypto';

export class StatementPdfFormatter {
  /**
   * Format a printable/exportable official periodic financial statement
   */
  formatStatement({
    workspaceName,
    currency = 'KES',
    periodLabel,
    generatedAt = new Date(),
    inflows = [],
    outflows = [],
    merkleRoot = '',
    sorobanContractId = '',
  }) {
    const totalInflowsMinor = inflows.reduce((sum, item) => sum + (Number(item.amountMinor) || 0), 0);
    const totalOutflowsMinor = outflows.reduce((sum, item) => sum + (Number(item.amountMinor) || 0), 0);
    const netSurplusMinor = totalInflowsMinor - totalOutflowsMinor;

    const fmt = (minor) => {
      const val = (minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${currency} ${val}`;
    };

    const separator = '='.repeat(72);
    const thinSeparator = '-'.repeat(72);

    const inflowRows = inflows.map(
      (item) => `  ${item.description.padEnd(46)} ${fmt(item.amountMinor).padStart(22)}`
    );
    const outflowRows = outflows.map(
      (item) => `  ${item.description.padEnd(46)} ${fmt(item.amountMinor).padStart(22)}`
    );

    const docId = `hesabu_stmt_${crypto.randomBytes(8).toString('hex')}`;

    const verificationStatus = (merkleRoot && sorobanContractId)
      ? 'INDEPENDENTLY AUDITABLE ON STELLAR HORIZON'
      : (merkleRoot ? 'CRYPTOGRAPHIC MERKLE ROOT CALCULATED (LOCAL STATEMENT AUDIT)' : 'PENDING ON-CHAIN ANCHORING');

    return `${separator}
HESABU ENTERPRISE FINANCIAL STATEMENT
Workspace: ${workspaceName}
Document ID: ${docId}
Reporting Period: ${periodLabel}
Issued: ${generatedAt.toISOString()}
${separator}

1. INFLOWS & OPERATING COLLECTIONS
${thinSeparator}
${inflowRows.join('\n') || '  No collections recorded in this period'}
${thinSeparator}
  TOTAL INFLOWS:                                 ${fmt(totalInflowsMinor).padStart(22)}

2. OUTFLOWS, EXPENDITURES & DISBURSEMENTS
${thinSeparator}
${outflowRows.join('\n') || '  No expenditures recorded in this period'}
${thinSeparator}
  TOTAL OUTFLOWS:                                ${fmt(totalOutflowsMinor).padStart(22)}

${separator}
NET OPERATIONAL SURPLUS / (DEFICIT):             ${fmt(netSurplusMinor).padStart(22)}
${separator}

3. CRYPTOGRAPHIC PROOF & ANCHORING AUDIT
${thinSeparator}
Merkle Root SHA-256:
${merkleRoot || 'NOT_ANCHORED'}

Stellar Soroban Contract Address:
${sorobanContractId || 'NOT_CONFIGURED'}

Verification Status: ${verificationStatus}
${separator}
End of Official Statement
`;
  }
}

export const statementPdfFormatter = new StatementPdfFormatter();
