import { AppError } from '../../shared/errors.js';
import { env } from '../../config/env.js';
import { initiateMpesaSTKPush, verifyMpesaCallback } from '../mpesa/mpesaService.js';
import { isAuthorizedDarajaIp, validateStkCallbackPayload } from '../mpesa/mpesaSecurity.js';
import { verifyStellarTransaction } from '../stellar/stellarService.js';

/**
 * Base Abstract Payment Provider Contract
 */
export class BasePaymentProvider {
  constructor(name) {
    this.name = name;
  }

  async createPayment() {
    throw new AppError(`createPayment not implemented on ${this.name}`, 500);
  }

  async verifyEvent() {
    throw new AppError(`verifyEvent not implemented on ${this.name}`, 500);
  }

  async checkStatus() {
    throw new AppError(`checkStatus not implemented on ${this.name}`, 500);
  }

  normalizeEvent(rawEvent) {
    return {
      provider: this.name,
      rawEvent,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Safaricom M-Pesa Daraja Provider
 */
export class MpesaPaymentProvider extends BasePaymentProvider {
  constructor() {
    super('MPESA');
  }

  async createPayment({ phoneNumber, amountMinor, accountReference, transactionDesc, callbackUrl }) {
    if (!phoneNumber) {
      throw new AppError('Phone number is required for M-Pesa STK Push.', 400);
    }
    const stk = await initiateMpesaSTKPush({
      phoneNumber,
      amountMinor,
      accountReference,
      transactionDesc,
      callbackUrl
    });
    return {
      rail: 'MPESA',
      providerRef: stk.checkoutRequestId,
      merchantRequestId: stk.merchantRequestId,
      checkoutRequestId: stk.checkoutRequestId,
      customerMessage: stk.customerMessage,
      status: 'PROCESSING'
    };
  }

  async verifyEvent({ callbackBody, remoteIp, expectedPayment }) {
    if (!isAuthorizedDarajaIp(remoteIp)) {
      throw new AppError(`Unauthorized M-Pesa webhook source IP: ${remoteIp}`, 403);
    }
    const validation = validateStkCallbackPayload(callbackBody);
    if (!validation.valid) {
      throw new AppError(`Invalid M-Pesa callback payload: ${validation.error}`, 400);
    }

    const verified = verifyMpesaCallback({
      callbackBody,
      expectedCheckoutRequestId: expectedPayment?.checkoutRequestId || expectedPayment?.providerRef
    });

    // Validate expected payment amount
    if (expectedPayment) {
      const expectedAmountWhole = Math.round(Number(expectedPayment.amountMinor) / 100);
      if (verified.amountPaid !== null && verified.amountPaid !== expectedAmountWhole) {
        throw new AppError(
          `M-Pesa payment amount mismatch: expected ${expectedAmountWhole} KES, received ${verified.amountPaid} KES.`,
          400
        );
      }
    }

    return {
      rail: 'MPESA',
      verified: true,
      receiptNumber: verified.receiptNumber,
      amountPaid: verified.amountPaid,
      phoneNumber: verified.phoneNumber,
      checkoutRequestId: verified.checkoutRequestId,
      merchantRequestId: verified.merchantRequestId,
      resultDesc: verified.resultDesc,
      raw: callbackBody
    };
  }
}

/**
 * Stellar Network & USDC Payment Provider
 */
export class StellarPaymentProvider extends BasePaymentProvider {
  constructor() {
    super('STELLAR');
  }

  async createPayment({ obligationId, currency, destinationAccount }) {
    const memo = `HESABU-${obligationId.slice(0, 8)}`;
    return {
      rail: 'STELLAR',
      memo,
      network: env.STELLAR_NETWORK || 'testnet',
      destinationAccount: destinationAccount || env.STELLAR_RECEIVER_ACCOUNT || null,
      assetCode: currency === 'KES' ? 'KES' : 'USDC',
      status: 'PENDING'
    };
  }

  async verifyEvent({ txHash, expectedDestination, expectedMemo, expectedAmountMinor, expectedAssetCode, expectedAssetIssuer }) {
    const verification = await verifyStellarTransaction({
      txHash,
      expectedDestination,
      expectedMemo,
      expectedAmountMinor,
      expectedAssetCode,
      expectedAssetIssuer
    });

    return {
      rail: 'STELLAR',
      verified: true,
      txHash: verification.txHash,
      ledger: verification.ledger,
      sourceAccount: verification.sourceAccount,
      memo: verification.memo,
      network: verification.network,
      verificationData: verification
    };
  }
}

/**
 * South Africa Instant EFT & PayShap Provider
 */
export class SouthAfricaEftPaymentProvider extends BasePaymentProvider {
  constructor() {
    super('PAYSHAP_EFT');
  }

  async createPayment({ amountMinor, currency = 'ZAR', recipientReference, aliasNumber }) {
    if (currency !== 'ZAR') {
      throw new AppError('PayShap and Instant EFT only support ZAR transactions.', 400);
    }
    const cleanRef = (recipientReference || `HESABU-${Date.now().toString(36)}`).slice(0, 20).toUpperCase();
    return {
      rail: 'PAYSHAP_EFT',
      providerRef: cleanRef,
      paymentReference: cleanRef,
      aliasNumber: aliasNumber || null,
      status: 'PENDING'
    };
  }

  async verifyEvent({ referenceNumber, bankRef, amountMinor, expectedPayment }) {
    if (!referenceNumber) {
      throw new AppError('South Africa EFT verification requires a reference number.', 400);
    }
    if (expectedPayment && BigInt(expectedPayment.amountMinor) !== BigInt(amountMinor)) {
      throw new AppError('EFT settlement amount does not match expected invoice/obligation amount.', 400);
    }
    return {
      rail: 'PAYSHAP_EFT',
      verified: true,
      referenceNumber: referenceNumber.toUpperCase(),
      bankRef: bankRef || `ZA-EFT-${Date.now()}`,
      amountMinor: BigInt(amountMinor)
    };
  }
}

/**
 * Development Simulation Provider
 */
export class DevelopmentPaymentProvider extends BasePaymentProvider {
  constructor() {
    super('DEVELOPMENT');
  }

  async createPayment({ obligationId }) {
    if (env.PAYMENT_MODE !== 'development') {
      throw new AppError('Development payments are disabled in non-development mode.', 403);
    }
    return {
      rail: 'DEVELOPMENT',
      providerRef: `DEV-INTENT-${obligationId.slice(0, 8)}-${Date.now()}`,
      status: 'PENDING'
    };
  }

  async verifyEvent({ paymentId }) {
    if (env.PAYMENT_MODE !== 'development') {
      throw new AppError('Development confirmation is disabled in non-development mode.', 403);
    }
    return {
      rail: 'DEVELOPMENT',
      verified: true,
      externalRef: `DEV-SETTLE-${paymentId}`
    };
  }
}

/**
 * Provider Registry
 */
export const paymentProviders = {
  MPESA: new MpesaPaymentProvider(),
  STELLAR: new StellarPaymentProvider(),
  PAYSHAP_EFT: new SouthAfricaEftPaymentProvider(),
  DEVELOPMENT: new DevelopmentPaymentProvider()
};

export function getPaymentProvider(rail) {
  const provider = paymentProviders[rail];
  if (!provider) {
    throw new AppError(`Unsupported payment rail: ${rail}`, 400);
  }
  return provider;
}
