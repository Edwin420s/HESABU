import { money } from '../../shared/money.js';

/**
 * Payment Voucher & Financial Receipt Formatter
 * Generates structured, compliant receipt records suitable for printing, export, or email delivery.
 */
export function generatePaymentReceipt({ payment, obligation, workspace }) {
  if (!payment) throw new Error('Payment record required');

  const receipt = {
    receiptNumber: `RCP-${payment.id.slice(0, 8).toUpperCase()}`,
    issuedAt: new Date(payment.createdAt).toISOString(),
    settledAt: payment.settledAt ? new Date(payment.settledAt).toISOString() : new Date().toISOString(),
    status: payment.status,
    workspace: {
      id: workspace?.id,
      name: workspace?.name,
      currency: workspace?.currency || 'KES',
    },
    payer: {
      name: obligation?.memberName || 'Member',
      email: obligation?.memberEmail || null,
    },
    obligation: {
      id: obligation?.id,
      title: obligation?.title,
    },
    financials: {
      amountMinor: payment.amountMinor.toString(),
      amountFormatted: money(payment.amountMinor, workspace?.currency || 'KES'),
      rail: payment.rail || payment.method,
      reference: payment.txHash || payment.providerRef || 'N/A',
    },
    verificationProof: {
      isVerified: payment.status === 'CONFIRMED' || payment.status === 'SETTLED',
      network: payment.rail === 'STELLAR' || payment.method === 'STELLAR' ? 'Stellar Horizon' : (payment.rail === 'MPESA' || payment.method === 'MPESA' ? 'Safaricom Daraja' : 'Electronic Settlement Rail'),
      verificationHash: payment.txHash || payment.providerRef || null,
    },
  };

  return receipt;
}

export function generateReceiptVoucher(params) {
  if (params.payment) {
    return generatePaymentReceipt(params);
  }
  const { paymentId, receiptNumber, workspaceName, memberName, amountMinor, currency, method, status, timestamp } = params;
  return {
    receiptNumber: receiptNumber || `RCP-${String(paymentId).slice(0, 8).toUpperCase()}`,
    issuedAt: new Date(timestamp || Date.now()).toISOString(),
    settledAt: status === 'CONFIRMED' || status === 'SETTLED' ? new Date(timestamp || Date.now()).toISOString() : null,
    status: status || 'CONFIRMED',
    workspace: {
      name: workspaceName || 'HESABU Workspace',
      currency: currency || 'KES',
    },
    payer: {
      name: memberName || 'Member',
    },
    financials: {
      amountMinor: String(amountMinor),
      amountFormatted: money(amountMinor, currency || 'KES'),
      rail: method || 'N/A',
      reference: receiptNumber || 'N/A',
    },
    verificationProof: {
      isVerified: status === 'CONFIRMED' || status === 'SETTLED',
      network: method === 'STELLAR' ? 'Stellar Horizon' : method === 'MPESA' ? 'Safaricom Daraja' : method === 'PAYSHAP' ? 'PayShap ZA' : 'Electronic Settlement Rail',
      verificationHash: receiptNumber || null,
    },
  };
}
