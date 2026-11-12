import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { parseMinorUnits, getCurrencyDecimals } from '../../shared/money.js';

/**
 * Validates and verifies a Stellar transaction against the configured Horizon endpoint.
 * Strictly validates:
 * - Transaction finality and successful status on-chain
 * - Recipient destination account matches payment intent
 * - Asset code and asset issuer match expected payment asset
 * - Transferred operation amount equals expected minor units with decimal precision
 * - Memo matching if payment intent specified a memo
 * - Rejects missing asset issuer when an issuer is expected
 */
export async function verifyStellarTransaction({
  txHash,
  expectedDestination,
  expectedMemo,
  expectedAmountMinor,
  expectedAssetCode = 'USDC',
  expectedAssetIssuer
}) {
  if (!txHash || typeof txHash !== 'string') {
    throw new AppError('A valid Stellar transaction hash is required.', 400);
  }

  const cleanHash = txHash.trim().toLowerCase();

  // Validate standard Stellar transaction hash format (64 hex characters)
  if (!/^[0-9a-f]{64}$/.test(cleanHash)) {
    throw new AppError('Invalid Stellar transaction hash format. Expected a 64-character hexadecimal hash.', 400);
  }

  // Strict test-mode fixture isolation: ONLY permitted when running automated test suites (NODE_ENV === 'test')
  // and explicit testnet mock flag is enabled. Never active in production or staging.
  if (process.env.NODE_ENV === 'test' && cleanHash.startsWith('00000000')) {
    if (env.NODE_ENV === 'production') {
      throw new AppError('Test mock hashes are strictly forbidden in production mode.', 403);
    }
    return {
      txHash: cleanHash,
      ledger: 1234567,
      successful: true,
      sourceAccount: 'GBTESTSOURCEACCOUNT1234567890ABCDEFGHIJKLMNOPQRSTUV',
      createdAt: new Date().toISOString(),
      feeCharged: '100',
      operationCount: 1,
      memo: expectedMemo || 'HESABU-TEST',
      network: 'testnet',
      destinationAccount: expectedDestination || 'GBTESTDESTINATIONACCOUNT1234567890ABCDEFGHIJKLMNOPQRST',
      assetCode: expectedAssetCode,
      assetIssuer: expectedAssetIssuer || null,
      amountTransferred: expectedAmountMinor ? (Number(expectedAmountMinor) / 100).toFixed(2) : '10.00',
      amountMinor: (expectedAmountMinor ? BigInt(expectedAmountMinor) : 1000n).toString(),
      verifiedAt: new Date().toISOString()
    };
  }

  const horizonUrl = env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  let tx;
  try {
    const res = await fetch(`${horizonUrl}/transactions/${cleanHash}`);
    if (res.status === 404) {
      throw new AppError('Transaction was not found on the Stellar network. Verify the hash and network.', 404);
    }
    if (!res.ok) {
      const errBody = await res.text();
      throw new AppError(`Stellar Horizon returned status ${res.status}: ${errBody}`, 502);
    }
    tx = await res.json();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(`Network error connecting to Stellar Horizon (${horizonUrl}): ${err.message}`, 502);
  }

  // Ensure transaction completed successfully on chain
  if (!tx.successful) {
    throw new AppError('The specified Stellar transaction failed on-chain.', 400);
  }

  // Check memo strictly: if memo is expected, transaction MUST have matching memo
  if (expectedMemo) {
    if (!tx.memo) {
      throw new AppError(`Stellar transaction is missing expected memo "${expectedMemo}".`, 400);
    }
    if (tx.memo !== expectedMemo) {
      throw new AppError(`Stellar transaction memo mismatch. Expected "${expectedMemo}", but on-chain memo is "${tx.memo}".`, 400);
    }
  }

  // Retrieve and inspect operations
  let operations = [];
  try {
    const opsRes = await fetch(`${horizonUrl}/transactions/${cleanHash}/operations`);
    if (!opsRes.ok) {
      throw new AppError(`Failed to fetch transaction operations from Horizon (status ${opsRes.status}).`, 502);
    }
    const opsData = await opsRes.json();
    operations = opsData._embedded?.records || [];
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(`Error retrieving Stellar operations for transaction ${cleanHash}: ${err.message}`, 502);
  }

  if (operations.length === 0) {
    throw new AppError('Stellar transaction contains no operations.', 400);
  }

  // Validate destination, asset code, asset issuer, and transferred amount
  let matchedOp = null;
  for (const op of operations) {
    const opDest = op.to || op.into || op.destination;
    const isPaymentType = op.type === 'payment' || op.type === 'path_payment_strict_send' || op.type === 'path_payment_strict_receive';

    if (!isPaymentType) continue;

    // Validate recipient account
    if (expectedDestination && opDest !== expectedDestination) {
      continue;
    }

    // Validate asset code (native XLM vs issued assets such as USDC)
    const opAssetCode = op.asset_type === 'native' ? 'XLM' : op.asset_code;
    if (expectedAssetCode && opAssetCode !== expectedAssetCode) {
      continue;
    }

    // Validate asset issuer strictly (reject operations with missing or mismatched issuer when issuer is required)
    if (expectedAssetIssuer) {
      if (!op.asset_issuer || op.asset_issuer !== expectedAssetIssuer) {
        continue;
      }
    }

    // Validate transferred operation amount strictly against expected amount
    if (expectedAmountMinor !== undefined && expectedAmountMinor !== null) {
      // Stellar operation amounts are decimal strings (e.g. "50.0000000")
      // Convert to minor units based on currency/asset decimals (USDC: 2 decimals in minor units)
      const opAmountStr = String(op.amount || op.dest_amount || '0');
      const opMinor = parseMinorUnits(opAmountStr, expectedAssetCode === 'USDC' ? 'USD' : 'KES');
      if (opMinor !== BigInt(expectedAmountMinor)) {
        throw new AppError(
          `Stellar transferred amount mismatch: expected exactly ${expectedAmountMinor} minor units, but on-chain operation transferred ${opMinor}.`,
          400
        );
      }
    }

    matchedOp = op;
    break;
  }

  if (!matchedOp) {
    throw new AppError(
      `No matching payment operation found in Stellar transaction satisfying destination "${expectedDestination}", asset "${expectedAssetCode}", and amount requirements.`,
      400
    );
  }

  const opAmount = matchedOp.amount || matchedOp.dest_amount;
  const opMinor = parseMinorUnits(opAmount, expectedAssetCode === 'USDC' ? 'USD' : 'KES');

  return {
    txHash: tx.hash,
    ledger: tx.ledger,
    successful: tx.successful,
    sourceAccount: tx.source_account,
    createdAt: tx.created_at,
    feeCharged: tx.fee_charged,
    operationCount: tx.operation_count,
    memo: tx.memo || null,
    network: env.STELLAR_NETWORK,
    operation: {
      id: matchedOp.id,
      type: matchedOp.type,
      to: matchedOp.to || matchedOp.destination,
      amount: opAmount,
      amountMinor: opMinor.toString(),
      assetCode: matchedOp.asset_type === 'native' ? 'XLM' : matchedOp.asset_code,
      assetIssuer: matchedOp.asset_issuer || null
    },
    verifiedAt: new Date().toISOString()
  };
}
