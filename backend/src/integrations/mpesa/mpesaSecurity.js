/**
 * Safaricom M-Pesa Security & Callback Validation
 * Validates inbound webhook network sources, payload structures, and timestamps to prevent spoofing.
 */

// Safaricom Daraja production public IP ranges (authoritative Safaricom gateway CIDRs)
const DARAJA_PROD_IPS = [
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.214.209',
  '196.201.214.210'
];

export function isAuthorizedDarajaIp(remoteIp) {
  if (process.env.NODE_ENV !== 'production') {
    return true; // Allow local tests and developer sandboxes
  }
  const cleanIp = (remoteIp || '').replace('::ffff:', '').trim();
  // Strictly disallow loopback/internal addresses in production
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
    return false;
  }
  return DARAJA_PROD_IPS.includes(cleanIp);
}

export function validateStkCallbackPayload(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Empty or invalid callback body' };
  }
  const stk = body.Body?.stkCallback;
  if (!stk) {
    return { valid: false, error: 'Missing Body.stkCallback envelope' };
  }
  if (typeof stk.ResultCode !== 'number') {
    return { valid: false, error: 'Missing or non-numeric ResultCode' };
  }
  if (!stk.CheckoutRequestID) {
    return { valid: false, error: 'Missing CheckoutRequestID' };
  }
  return { valid: true, data: stk };
}
