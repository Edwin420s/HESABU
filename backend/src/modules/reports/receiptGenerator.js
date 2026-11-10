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
      rail: payment.rail,
      reference: payment.txHash || payment.providerRef || 'N/A',
    },
    verificationProof: {
      isVerified: payment.status === 'CONFIRMED' || payment.status === 'SETTLED',
      network: payment.rail === 'STELLAR' ? 'Stellar Horizon Testnet' : payment.rail === 'MPESA' ? 'Safaricom Daraja' : 'Sandbox',
      verificationHash: payment.txHash || payment.providerRef || null,
    },
  };

  return receipt;
}
