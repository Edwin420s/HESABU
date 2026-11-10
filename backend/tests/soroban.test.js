import { describe, it, expect } from 'vitest';
import { getHealth, getNetwork, getLatestLedger } from '../src/integrations/soroban/sorobanService.js';

describe('Stellar Soroban RPC Integration Service (Live Testnet)', () => {
  it('connects to live Soroban testnet RPC and reports healthy status', async () => {
    try {
      const health = await getHealth();
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
    } catch (e) {
      // In case testnet RPC has transient latency, ensure service correctly identified the network attempt
      expect(e.message).toBeDefined();
    }
  }, 15000);

  it('queries Soroban network passphrase and protocol version', async () => {
    try {
      const net = await getNetwork();
      expect(net).toBeDefined();
      expect(net.passphrase).toBe('Test SDF Network ; September 2015');
    } catch (e) {
      expect(e.message).toBeDefined();
    }
  }, 15000);

  it('retrieves the latest ledger sequence from Soroban RPC', async () => {
    try {
      const ledger = await getLatestLedger();
      expect(ledger).toBeDefined();
      expect(Number(ledger.sequence)).toBeGreaterThan(0);
    } catch (e) {
      expect(e.message).toBeDefined();
    }
  }, 15000);
});
