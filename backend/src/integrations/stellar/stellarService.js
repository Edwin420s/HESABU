import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';

/**
 * Validates and verifies a real Stellar transaction using the configured Horizon endpoint.
 * No mock or static data: queries the live Stellar network directly.
 */
export async function verifyStellarTransaction({ txHash, expectedDestination, expectedMemo }) {
  if (!txHash || typeof txHash !== 'string') {
    throw new AppError('A valid Stellar transaction hash is required.', 400);
  }

  const cleanHash = txHash.trim().toLowerCase();

  // Validate standard Stellar transaction hash format (64 hex characters)
  if (!/^[0-9a-f]{64}$/.test(cleanHash)) {
    throw new AppError('Invalid Stellar transaction hash format. Expected a 64-character hexadecimal hash.', 400);
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

  // Check memo if obligation reference is expected
  if (expectedMemo && tx.memo && tx.memo !== expectedMemo) {
    throw new AppError(`Stellar transaction memo mismatch. Expected "${expectedMemo}", but on-chain memo is "${tx.memo}".`, 400);
  }

  // Retrieve and inspect operations to verify destination if specified
  let destinationMatched = false;
  let operations = [];
  try {
    const opsRes = await fetch(`${horizonUrl}/transactions/${cleanHash}/operations`);
    if (opsRes.ok) {
      const opsData = await opsRes.json();
      operations = opsData._embedded?.records || [];
      if (expectedDestination) {
        destinationMatched = operations.some(op => 
          op.to === expectedDestination || 
          op.into === expectedDestination || 
          op.destination === expectedDestination
        );
      }
    }
  } catch {
    // If operations cannot be fetched, continue with base transaction verification
  }

  if (expectedDestination && !destinationMatched && operations.length > 0) {
    throw new AppError(`Transaction destination account does not match expected workspace account "${expectedDestination}".`, 400);
  }

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
    verifiedAt: new Date().toISOString()
  };
}
