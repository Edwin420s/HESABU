import { env } from '../../config/env.js';

const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

/**
 * Soroban RPC Service
 * Handles querying on-chain Soroban contract state, transaction simulation, and event ingestion.
 */
export async function getHealth() {
  const res = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getHealth',
    }),
  });
  if (!res.ok) throw new Error(`Soroban RPC unreachable: ${res.statusText}`);
  const data = await res.json();
  return data.result;
}

export async function getNetwork() {
  const res = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'getNetwork',
    }),
  });
  if (!res.ok) throw new Error(`Failed to query Soroban network: ${res.statusText}`);
  const data = await res.json();
  return data.result;
}

export async function getLatestLedger() {
  const res = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'getLatestLedger',
    }),
  });
  if (!res.ok) throw new Error(`Failed to query latest ledger: ${res.statusText}`);
  const data = await res.json();
  return data.result;
}

export async function getContractEvents({ startLedger, contractIds = [], limit = 10 } = {}) {
  const params = {
    startLedger,
    pagination: { limit },
  };
  if (contractIds.length > 0) {
    params.filters = [{ type: 'contract', contractIds }];
  }

  const res = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 4,
      method: 'getEvents',
      params,
    }),
  });
  if (!res.ok) throw new Error(`Failed to query contract events: ${res.statusText}`);
  const data = await res.json();
  return data.result;
}
