import { AppError } from '../../shared/errors.js';

/**
 * Initiates an M-Pesa Daraja STK Push (Lipa na M-Pesa Online).
 * Requires Safaricom API credentials in environment; no mock or fake fallbacks.
 */
export async function initiateMpesaSTKPush({
  phoneNumber,
  amountMinor,
  accountReference,
  transactionDesc,
  callbackUrl
}) {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const environment = process.env.MPESA_ENVIRONMENT || 'sandbox';

  if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
    throw new AppError(
      'M-Pesa credentials not configured. Please set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, and MPESA_PASSKEY to process Daraja payments.',
      400
    );
  }

  // Validate Kenyan phone format (254XXXXXXXXX)
  let cleanPhone = String(phoneNumber).trim().replace(/^\+/, '');
  if (cleanPhone.startsWith('0')) cleanPhone = `254${cleanPhone.slice(1)}`;
  if (!/^254[17]\d{8}$/.test(cleanPhone)) {
    throw new AppError('Invalid Kenyan phone number. Expected format: 2547XXXXXXXX or 2541XXXXXXXX.', 400);
  }

  const baseUrl = environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  // 1. Obtain OAuth Access Token from Safaricom
  const authHeader = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${authHeader}` }
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new AppError(`Safaricom OAuth authentication failed (${tokenRes.status}): ${errText}`, 502);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // 2. Compute timestamp and password
  const date = new Date();
  const timestamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ].join('');

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const amountWhole = Math.max(1, Math.round(Number(amountMinor) / 100));

  // 3. Send STK Push request to Safaricom
  const pushRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amountWhole,
      PartyA: cleanPhone,
      PartyB: shortcode,
      PhoneNumber: cleanPhone,
      CallBackURL: callbackUrl || `${process.env.APP_URL || 'http://localhost:4000'}/api/payments/mpesa-callback`,
      AccountReference: accountReference.slice(0, 12),
      TransactionDesc: (transactionDesc || 'HESABU Contribution').slice(0, 12)
    })
  });

  const pushData = await pushRes.json();
  if (!pushRes.ok || pushData.ResponseCode !== '0') {
    throw new AppError(`M-Pesa STK push rejected: ${pushData.ResponseDescription || pushData.errorMessage || 'Unknown error'}`, 400);
  }

  return {
    merchantRequestId: pushData.MerchantRequestID,
    checkoutRequestId: pushData.CheckoutRequestID,
    customerMessage: pushData.CustomerMessage,
    responseCode: pushData.ResponseCode
  };
}

/**
 * Validates real Safaricom M-Pesa webhook callback body.
 * No mock fallbacks.
 */
export function verifyMpesaCallback({ callbackBody, expectedCheckoutRequestId }) {
  if (!callbackBody || !callbackBody.Body || !callbackBody.Body.stkCallback) {
    throw new AppError('Invalid Safaricom M-Pesa callback format.', 400);
  }

  const stk = callbackBody.Body.stkCallback;

  if (expectedCheckoutRequestId && stk.CheckoutRequestID !== expectedCheckoutRequestId) {
    throw new AppError(`M-Pesa CheckoutRequestID mismatch: expected "${expectedCheckoutRequestId}", received "${stk.CheckoutRequestID}".`, 400);
  }

  if (stk.ResultCode !== 0) {
    throw new AppError(`M-Pesa transaction was not completed: ${stk.ResultDesc} (ResultCode: ${stk.ResultCode})`, 400);
  }

  const items = stk.CallbackMetadata?.Item || [];
  const receiptItem = items.find(i => i.Name === 'MpesaReceiptNumber');
  const amountItem = items.find(i => i.Name === 'Amount');
  const phoneItem = items.find(i => i.Name === 'PhoneNumber');

  if (!receiptItem?.Value) {
    throw new AppError('Safaricom callback missing required MpesaReceiptNumber.', 400);
  }

  return {
    receiptNumber: String(receiptItem.Value).trim().toUpperCase(),
    amountPaid: amountItem ? Number(amountItem.Value) : null,
    phoneNumber: phoneItem ? String(phoneItem.Value) : null,
    checkoutRequestId: stk.CheckoutRequestID,
    merchantRequestId: stk.MerchantRequestID,
    resultDesc: stk.ResultDesc
  };
}
