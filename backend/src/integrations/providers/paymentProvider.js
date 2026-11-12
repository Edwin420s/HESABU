import crypto from 'crypto';
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

  async createPayment({ obligationId, paymentId, currency, destinationAccount }) {
    const memo = `PAY-${(paymentId || obligationId).slice(-10).toUpperCase()}`;
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
 * Supports real provider webhook signature verification (HMAC-SHA256) for PayShap / Stitch / Ozow,
 * raw event persistence, anti-tampering validation, and rejects unverified user claims.
 */
export class SouthAfricaEftPaymentProvider extends BasePaymentProvider {
  constructor() {
    super('PAYSHAP_EFT');
    if (process.env.NODE_ENV === 'production' && !process.env.ZA_PAYMENT_WEBHOOK_SECRET) {
      throw new AppError('ZA_PAYMENT_WEBHOOK_SECRET is required in production environment.', 500);
    }
    this.webhookSecret = process.env.ZA_PAYMENT_WEBHOOK_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'hesabu_za_secret_dev_key');
  }

  /**
   * Generates a signed PayShap / EFT payment intent request
   */
  async createPayment({ amountMinor, currency = 'ZAR', recipientReference, aliasNumber, payerId }) {
    if (currency !== 'ZAR') {
      throw new AppError('PayShap and Instant EFT only support South African Rand (ZAR) transactions.', 400);
    }

    const intentId = `PSHAP-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
    const cleanRef = (recipientReference || intentId).slice(0, 20).toUpperCase();

    // Construct cryptographic challenge token for webhook matching
    const challengeToken = crypto.createHmac('sha256', this.webhookSecret)
      .update(`${intentId}:${amountMinor}:${cleanRef}`)
      .digest('hex');

    const gatewayBase = process.env.ZA_PAYMENT_GATEWAY_URL || (process.env.NODE_ENV === 'production' ? 'https://api.payshap.co.za' : 'https://checkout.payshap.za');

    return {
      rail: 'PAYSHAP_EFT',
      providerRef: intentId,
      paymentReference: cleanRef,
      aliasNumber: aliasNumber || null,
      challengeToken,
      status: 'PENDING',
      redirectUrl: `${gatewayBase}/pay?intent=${intentId}&ref=${cleanRef}`
    };
  }

  /**
   * Validates authenticated webhook event from South African bank clearing node / PSP
   */
  async verifyEvent({ webhookPayload, signature, timestamp, rawBody, expectedPayment }) {
    if (!webhookPayload && !rawBody) {
      throw new AppError('South Africa PayShap verification requires a webhook payload.', 400);
    }

    const payload = typeof webhookPayload === 'object' ? webhookPayload : JSON.parse(rawBody || '{}');
    const signatureToVerify = signature || payload.signature;

    // In production, HMAC-SHA256 signature is strictly mandatory
    if (process.env.NODE_ENV === 'production' || process.env.ENFORCE_ZA_WEBHOOK_SIGNATURE === 'true') {
      if (!signatureToVerify) {
        throw new AppError('Missing required HMAC-SHA256 signature from South African payment gateway.', 401);
      }
      if (!this.webhookSecret) {
        throw new AppError('Payment webhook secret is not configured on the server.', 500);
      }

      const dataToSign = typeof rawBody === 'string' ? rawBody : JSON.stringify(payload);
      const expectedSignature = crypto.createHmac('sha256', this.webhookSecret).update(dataToSign).digest('hex');

      const sigBuf = Buffer.from(signatureToVerify, 'utf-8');
      const expBuf = Buffer.from(expectedSignature, 'utf-8');

      // Prevent RangeError exception on unequal buffer length in timingSafeEqual
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new AppError('Invalid South Africa payment webhook signature. Tampered payload rejected.', 403);
      }
    }

    // Webhook timestamp freshness check to prevent replay attacks
    const eventTime = timestamp || payload.timestamp || payload.createdAt;
    if (eventTime) {
      const eventTimestamp = new Date(eventTime).getTime();
      const now = Date.now();
      const maxAgeMs = 5 * 60 * 1000; // 5 minutes freshness window
      if (isNaN(eventTimestamp) || eventTimestamp > now + 60000 || (now - eventTimestamp) > maxAgeMs) {
        throw new AppError('Webhook signature timestamp expired or outside acceptable freshness window.', 401);
      }
    }

    // Verify event status is terminal and successful (SETTLED, COMPLETED, or SUCCESS)
    const eventStatus = (payload.status || payload.eventStatus || 'PENDING').toUpperCase();
    if (eventStatus !== 'SETTLED' && eventStatus !== 'COMPLETED' && eventStatus !== 'SUCCESS') {
      throw new AppError(`PayShap payment cannot be settled: provider status is "${eventStatus}".`, 400);
    }

    // Amount validation against expected obligation / invoice
    const settledAmountMinor = BigInt(payload.amountMinor || payload.amount || 0);
    if (expectedPayment && BigInt(expectedPayment.amountMinor) !== settledAmountMinor) {
      throw new AppError(
        `PayShap settlement amount mismatch: expected ${expectedPayment.amountMinor} cents, received ${settledAmountMinor} cents.`,
        400
      );
    }

    const providerTransactionId = payload.providerTransactionId || payload.transactionId;
    if (!providerTransactionId) {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Authoritative provider transaction ID is required for South African bank settlement.', 400);
      }
    }
    const finalTxId = providerTransactionId || `ZA-PSHAP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const clearingCode = payload.clearingCode || payload.bankRef || 'RTC-PAYSHAP-SETTLED';

    return {
      rail: 'PAYSHAP_EFT',
      verified: true,
      providerTransactionId: finalTxId,
      referenceNumber: (payload.referenceNumber || payload.reference || expectedPayment?.providerRef || '').toUpperCase(),
      bankRef: clearingCode,
      amountMinor: settledAmountMinor,
      payerBank: payload.payerBank || 'STANDARD_BANK',
      rawPayload: payload
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
