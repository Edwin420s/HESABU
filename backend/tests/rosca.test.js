import { describe, it, expect, beforeEach } from 'vitest';
import { RoscaService } from '../src/modules/rosca/roscaService.js';

describe('Chama ROSCA / Merry-Go-Round Engine', () => {
  let rosca;

  beforeEach(() => {
    rosca = new RoscaService();
  });

  it('initializes a rotation cycle with correct pot size and schedule', () => {
    const cycle = rosca.createCycle({
      workspaceId: 'ws_chama_1',
      name: 'Monthly Table Banking Circle',
      contributionPerMemberMinor: 500000, // KES 5,000.00
      frequencyDays: 30,
      memberIds: ['m_alice', 'm_bob', 'm_charlie'],
    });

    expect(cycle.id).toMatch(/^rosca_/);
    expect(cycle.totalRounds).toBe(3);
    expect(cycle.currentRound).toBe(1);
    expect(cycle.potPerRoundMinor).toBe(1500000); // 3 * 5,000 = KES 15,000.00
    expect(cycle.schedule.length).toBe(3);
    expect(cycle.schedule[0].status).toBe('ACTIVE');
    expect(cycle.schedule[0].beneficiaryMemberId).toBe('m_alice');
    expect(cycle.schedule[1].status).toBe('SCHEDULED');
  });

  it('records individual contributions and checks pot funding status', () => {
    const cycle = rosca.createCycle({
      workspaceId: 'ws_chama_1',
      name: 'Circle 2026',
      contributionPerMemberMinor: 100000,
      memberIds: ['m_1', 'm_2'],
    });

    const c1 = rosca.contribute(cycle.id, 'm_1', 100000);
    expect(c1.isPotFullyFunded).toBe(false);
    expect(c1.roundTotalCollectedMinor).toBe(100000);

    const c2 = rosca.contribute(cycle.id, 'm_2', 100000);
    expect(c2.isPotFullyFunded).toBe(true);
    expect(c2.roundTotalCollectedMinor).toBe(200000);
  });

  it('prevents payout if pot is not fully funded', () => {
    const cycle = rosca.createCycle({
      workspaceId: 'ws_chama_1',
      name: 'Circle Incomplete',
      contributionPerMemberMinor: 100000,
      memberIds: ['m_1', 'm_2'],
    });

    rosca.contribute(cycle.id, 'm_1', 50000); // Only partial

    expect(() => {
      rosca.executePayoutAndRotate(cycle.id);
    }).toThrow('Round pot is underfunded');
  });

  it('disburses payout, marks round complete, and advances turn order', () => {
    const cycle = rosca.createCycle({
      workspaceId: 'ws_chama_1',
      name: 'Circle Rotation',
      contributionPerMemberMinor: 200000,
      memberIds: ['m_1', 'm_2'],
    });

    rosca.contribute(cycle.id, 'm_1', 200000);
    rosca.contribute(cycle.id, 'm_2', 200000);

    const payout = rosca.executePayoutAndRotate(cycle.id);
    expect(payout.completedRound).toBe(1);
    expect(payout.beneficiaryId).toBe('m_1');
    expect(payout.payoutAmountMinor).toBe(400000);
    expect(payout.nextRound).toBe(2);
    expect(payout.cycleCompleted).toBe(false);

    // Verify round 2 is active
    const updated = rosca.getCycle(cycle.id);
    expect(updated.currentRound).toBe(2);
    expect(updated.schedule[1].status).toBe('ACTIVE');
  });
});
