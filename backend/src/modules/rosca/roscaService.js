import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';

export class RoscaService {
  constructor() {
    this.cycles = new Map();
  }

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

    const id = `rosca_${crypto.randomBytes(8).toString('hex')}`;
    const potPerRoundMinor = Number(contributionPerMemberMinor) * memberIds.length;

    const rotationSchedule = memberIds.map((mId, index) => ({
      roundNumber: index + 1,
      beneficiaryMemberId: mId,
      status: index === 0 ? 'ACTIVE' : 'SCHEDULED',
      expectedPayoutMinor: potPerRoundMinor,
      collectedMinor: 0,
      contributions: {},
      disbursedAt: null
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
      createdAt: new Date()
    };

    this.cycles.set(id, cycle);

    // Sync to PostgreSQL if DB is available
    prisma.roscaCycle.create({
      data: {
        workspaceId,
        name,
        contributionPerMemberMinor: BigInt(contributionPerMemberMinor),
        frequencyDays,
        currentRound: 1,
        totalRounds: memberIds.length,
        members: {
          create: memberIds.map((mId, idx) => ({ memberId: mId, position: idx + 1 }))
        },
        rounds: {
          create: memberIds.map((mId, idx) => ({
            roundNumber: idx + 1,
            beneficiaryMemberId: mId,
            expectedPayoutMinor: BigInt(potPerRoundMinor),
            status: 'PENDING'
          }))
        }
      }
    }).catch(() => {});

    return cycle;
  }

  getCycle(cycleId) {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) throw new Error(`ROSCA cycle ${cycleId} not found`);
    return cycle;
  }

  listCycles(workspaceId) {
    return Array.from(this.cycles.values()).filter(c => c.workspaceId === workspaceId);
  }

  contribute(cycleId, memberId, amountMinor) {
    const cycle = this.getCycle(cycleId);
    if (cycle.status !== 'ACTIVE') throw new Error(`Cycle is not active`);
    if (!cycle.members.includes(memberId)) throw new Error('Member is not enrolled in this ROSCA cycle');

    const activeRound = cycle.schedule.find(r => r.roundNumber === cycle.currentRound);
    if (!activeRound) throw new Error('No active round found');

    const amount = Number(amountMinor);
    if (amount <= 0) throw new Error('Contribution amount must be positive');

    activeRound.contributions[memberId] = (activeRound.contributions[memberId] || 0) + amount;
    activeRound.collectedMinor += amount;

    const isPotFullyFunded = activeRound.collectedMinor >= cycle.potPerRoundMinor;
    return {
      cycleId,
      roundNumber: activeRound.roundNumber,
      memberId,
      amountContributedMinor: amount,
      roundTotalCollectedMinor: activeRound.collectedMinor,
      isPotFullyFunded
    };
  }

  executePayoutAndRotate(cycleId) {
    const cycle = this.getCycle(cycleId);
    const activeRound = cycle.schedule.find(r => r.roundNumber === cycle.currentRound);
    if (!activeRound) throw new Error('No active round found');

    if (activeRound.collectedMinor < cycle.potPerRoundMinor) {
      throw new Error('Round pot is underfunded');
    }

    activeRound.status = 'COMPLETED';
    activeRound.disbursedAt = new Date();

    const completedRound = cycle.currentRound;
    const beneficiaryId = activeRound.beneficiaryMemberId;
    const payoutAmountMinor = cycle.potPerRoundMinor;

    const cycleCompleted = cycle.currentRound >= cycle.totalRounds;
    if (!cycleCompleted) {
      cycle.currentRound += 1;
      const nextRound = cycle.schedule.find(r => r.roundNumber === cycle.currentRound);
      if (nextRound) nextRound.status = 'ACTIVE';
    } else {
      cycle.status = 'COMPLETED';
    }

    return {
      cycleId,
      completedRound,
      beneficiaryId,
      payoutAmountMinor,
      nextRound: cycle.currentRound,
      cycleCompleted
    };
  }
}

export const roscaService = new RoscaService();
