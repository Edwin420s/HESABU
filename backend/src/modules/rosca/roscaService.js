import crypto from 'crypto';

export class RoscaService {
  constructor() {
    this.cycles = new Map();
  }

  /**
   * Create a new ROSCA / Merry-Go-Round cycle
   */
  createCycle({ workspaceId, name, contributionPerMemberMinor, frequencyDays = 30, memberIds = [] }) {
    if (!name || !workspaceId) {
      throw new Error('Workspace ID and cycle name are required');
    }
    if (!memberIds || memberIds.length < 2) {
      throw new Error('A ROSCA cycle requires at least 2 participating members');
    }
    if (contributionPerMemberMinor <= 0) {
      throw new Error('Contribution amount per member must be greater than zero');
    }

    const id = `rosca_${crypto.randomBytes(12).toString('hex')}`;
    const potPerRoundMinor = Number(contributionPerMemberMinor) * memberIds.length;

    // Initialize round order
    const rotationSchedule = memberIds.map((memberId, index) => ({
      roundNumber: index + 1,
      beneficiaryMemberId: memberId,
      status: index === 0 ? 'ACTIVE' : 'SCHEDULED',
      expectedPayoutMinor: potPerRoundMinor,
      disbursedAt: null,
      collectedMinor: 0,
      contributions: {},
    }));

    const cycle = {
      id,
      workspaceId,
      name,
      contributionPerMemberMinor: Number(contributionPerMemberMinor),
      potPerRoundMinor,
      frequencyDays,
      totalRounds: memberIds.length,
      currentRound: 1,
      status: 'ACTIVE',
      members: memberIds,
      schedule: rotationSchedule,
      createdAt: new Date(),
    };

    this.cycles.set(id, cycle);
    return cycle;
  }

  /**
   * Retrieve cycle by ID
   */
  getCycle(cycleId) {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) {
      throw new Error(`ROSCA cycle ${cycleId} not found`);
    }
    return cycle;
  }

  /**
   * List cycles for a workspace
   */
  listCycles(workspaceId) {
    return Array.from(this.cycles.values()).filter((c) => c.workspaceId === workspaceId);
  }

  /**
   * Record a member contribution for the active round
   */
  contribute(cycleId, memberId, amountMinor) {
    const cycle = this.getCycle(cycleId);
    if (cycle.status !== 'ACTIVE') {
      throw new Error(`Cycle is not active (current status: ${cycle.status})`);
    }

    if (!cycle.members.includes(memberId)) {
      throw new Error('Member is not enrolled in this ROSCA cycle');
    }

    const activeRound = cycle.schedule.find((r) => r.roundNumber === cycle.currentRound);
    if (!activeRound) {
      throw new Error('No active round found');
    }

    const parsedAmount = Number(amountMinor);
    if (parsedAmount <= 0) {
      throw new Error('Contribution amount must be positive');
    }

    const previousContribution = activeRound.contributions[memberId] || 0;
    activeRound.contributions[memberId] = previousContribution + parsedAmount;
    activeRound.collectedMinor += parsedAmount;

    return {
      cycleId,
      roundNumber: cycle.currentRound,
      memberId,
      totalContributedThisRound: activeRound.contributions[memberId],
      roundTotalCollectedMinor: activeRound.collectedMinor,
      potTargetMinor: cycle.potPerRoundMinor,
      isPotFullyFunded: activeRound.collectedMinor >= cycle.potPerRoundMinor,
    };
  }

  /**
   * Disburse the pot to the beneficiary and advance to the next round
   */
  executePayoutAndRotate(cycleId) {
    const cycle = this.getCycle(cycleId);
    const activeRound = cycle.schedule.find((r) => r.roundNumber === cycle.currentRound);

    if (!activeRound) {
      throw new Error('No active round available for payout');
    }

    if (activeRound.collectedMinor < cycle.potPerRoundMinor) {
      throw new Error(
        `Round pot is underfunded. Collected: ${activeRound.collectedMinor}, Required: ${cycle.potPerRoundMinor}`
      );
    }

    activeRound.status = 'COMPLETED';
    activeRound.disbursedAt = new Date();
    const beneficiaryId = activeRound.beneficiaryMemberId;
    const payoutAmountMinor = activeRound.collectedMinor;

    // Check if there are further rounds
    if (cycle.currentRound < cycle.totalRounds) {
      cycle.currentRound += 1;
      const nextRound = cycle.schedule.find((r) => r.roundNumber === cycle.currentRound);
      if (nextRound) {
        nextRound.status = 'ACTIVE';
      }
    } else {
      cycle.status = 'COMPLETED';
    }

    return {
      cycleId,
      completedRound: activeRound.roundNumber,
      beneficiaryId,
      payoutAmountMinor,
      nextRound: cycle.status === 'ACTIVE' ? cycle.currentRound : null,
      cycleCompleted: cycle.status === 'COMPLETED',
    };
  }
}

export const roscaService = new RoscaService();
