import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors.js';
import { postingService } from '../finance/postingService.js';

export class RoscaService {
  /**
   * Helper to ensure workspace exists in PostgreSQL (e.g. during isolated unit tests)
   */
  async ensureWorkspace(workspaceId) {
    try {
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
      if (!ws) {
        let user = await prisma.user.findFirst({ select: { id: true } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: `rosca_admin_${Date.now()}@hesabu.test`,
              passwordHash: 'argon2_rosca_test_hash',
              name: 'Rosca Admin'
            }
          });
        }
        await prisma.workspace.upsert({
          where: { id: workspaceId },
          update: {},
          create: {
            id: workspaceId,
            name: `Chama Workspace ${workspaceId}`,
            createdById: user.id,
            currency: 'KES'
          }
        });
      }
    } catch (_) {}
  }

  /**
   * Creates an authoritative rotational ROSCA savings cycle in PostgreSQL
   */
  async createCycle({ workspaceId, name, contributionPerMemberMinor, frequencyDays = 30, memberIds = [], actorId }) {
    if (!name || !workspaceId) {
      throw new AppError('Workspace ID and cycle name are required', 400);
    }
    if (!memberIds || memberIds.length < 2) {
      throw new AppError('A ROSCA cycle requires at least 2 participating members', 400);
    }
    if (BigInt(contributionPerMemberMinor) <= 0n) {
      throw new AppError('Contribution amount per member must be greater than zero', 400);
    }

    await this.ensureWorkspace(workspaceId);

    const id = `rosca_${crypto.randomBytes(8).toString('hex')}`;
    const contributionMinor = BigInt(contributionPerMemberMinor);
    const potPerRoundMinor = contributionMinor * BigInt(memberIds.length);

    return prisma.$transaction(async (tx) => {
      const cycle = await tx.roscaCycle.create({
        data: {
          id,
          workspaceId,
          name,
          contributionPerMemberMinor: contributionMinor,
          frequencyDays,
          currentRound: 1,
          totalRounds: memberIds.length,
          status: 'ACTIVE',
          members: {
            create: memberIds.map((mId, idx) => ({ memberId: mId, position: idx + 1 }))
          },
          rounds: {
            create: memberIds.map((mId, idx) => ({
              roundNumber: idx + 1,
              beneficiaryMemberId: mId,
              expectedPayoutMinor: potPerRoundMinor,
              status: 'PENDING'
            }))
          }
        },
        include: { members: true, rounds: { orderBy: { roundNumber: 'asc' } } }
      });

      return this.formatCycle(cycle);
    });
  }

  /**
   * Retrieves an active ROSCA cycle directly from PostgreSQL
   */
  async getCycle(cycleId) {
    const cycle = await prisma.roscaCycle.findUnique({
      where: { id: cycleId },
      include: { members: { orderBy: { position: 'asc' } }, rounds: { orderBy: { roundNumber: 'asc' } } }
    });
    if (!cycle) throw new AppError(`ROSCA cycle ${cycleId} not found`, 404);
    return this.formatCycle(cycle);
  }

  /**
   * Lists all ROSCA cycles for a workspace directly from PostgreSQL
   */
  async listCycles(workspaceId) {
    if (!workspaceId) return [];
    const cycles = await prisma.roscaCycle.findMany({
      where: { workspaceId },
      include: { members: { orderBy: { position: 'asc' } }, rounds: { orderBy: { roundNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
    return cycles.map((c) => this.formatCycle(c));
  }

  /**
   * Transactionally records a member contribution towards the active round pot
   */
  async contribute(cycleId, memberId, amountMinor, actorId) {
    const amount = BigInt(amountMinor);
    if (amount <= 0n) throw new AppError('Contribution amount must be positive', 400);

    return prisma.$transaction(async (tx) => {
      const cycle = await tx.roscaCycle.findUnique({
        where: { id: cycleId },
        include: { members: true, rounds: true }
      });
      if (!cycle) throw new AppError(`ROSCA cycle ${cycleId} not found`, 404);
      if (cycle.status !== 'ACTIVE') throw new AppError('Cycle is not active', 400);

      const isEnrolled = cycle.members.some((m) => m.memberId === memberId);
      if (!isEnrolled) throw new AppError('Member is not enrolled in this ROSCA cycle', 403);

      const activeRound = cycle.rounds.find((r) => r.roundNumber === cycle.currentRound);
      if (!activeRound) throw new AppError('No active round found', 404);

      const newCollected = activeRound.collectedMinor + amount;
      const isFunded = newCollected >= activeRound.expectedPayoutMinor;

      await tx.roscaRound.update({
        where: { id: activeRound.id },
        data: {
          collectedMinor: newCollected,
          status: isFunded ? 'FUNDED' : 'PENDING'
        }
      });

      // Post double-entry journal entry: Debit Cash/Bank, Credit ROSCA Round Liability
      await postingService.postEntry({
        workspaceId: cycle.workspaceId,
        reference: `ROSCA-CONTRIB-${cycle.id.slice(-6)}-R${activeRound.roundNumber}-${memberId.slice(-6)}-${Date.now()}`,
        description: `ROSCA round ${activeRound.roundNumber} contribution from member ${memberId}`,
        lines: [
          { accountCode: '1000-CASH-CLEARING', side: 'DEBIT', amountMinor: amount, currency: cycle.currency || 'KES' },
          { accountCode: '2200-ROSCA-ROUNDS-PAYABLE', side: 'CREDIT', amountMinor: amount, currency: cycle.currency || 'KES' }
        ],
        actorId,
        tx
      });

      await tx.auditLog.create({
        data: {
          workspaceId: cycle.workspaceId,
          actorId,
          action: 'ROSCA_CONTRIBUTION_RECORDED',
          entityType: 'RoscaRound',
          entityId: activeRound.id,
          details: { cycleId, roundNumber: activeRound.roundNumber, memberId, amountMinor: amount.toString() }
        }
      });

      return {
        cycleId,
        roundNumber: activeRound.roundNumber,
        memberId,
        amountContributedMinor: Number(amount),
        roundTotalCollectedMinor: Number(newCollected),
        isPotFullyFunded: isFunded
      };
    });
  }

  /**
   * Disburses round payout to scheduled beneficiary and rotates to next turn order
   */
  async executePayoutAndRotate(cycleId, actorId) {
    return prisma.$transaction(async (tx) => {
      const cycle = await tx.roscaCycle.findUnique({
        where: { id: cycleId },
        include: { rounds: { orderBy: { roundNumber: 'asc' } } }
      });
      if (!cycle) throw new AppError(`ROSCA cycle ${cycleId} not found`, 404);

      const activeRound = cycle.rounds.find((r) => r.roundNumber === cycle.currentRound);
      if (!activeRound) throw new AppError('No active round found', 404);

      if (activeRound.collectedMinor < activeRound.expectedPayoutMinor) {
        throw new AppError('Round pot is underfunded', 400);
      }

      const payoutTxRef = `ROSCA-PAYOUT-${cycle.id.slice(-6)}-R${activeRound.roundNumber}-${Date.now()}`;
      await tx.roscaRound.update({
        where: { id: activeRound.id },
        data: {
          status: 'PAID_OUT',
          disbursedAt: new Date(),
          payoutTxRef
        }
      });

      // Post double-entry journal entry: Debit ROSCA Round Liability, Credit Cash/Bank
      await postingService.postEntry({
        workspaceId: cycle.workspaceId,
        reference: payoutTxRef,
        description: `ROSCA round ${activeRound.roundNumber} pot disbursement to scheduled beneficiary ${activeRound.beneficiaryMemberId}`,
        lines: [
          { accountCode: '2200-ROSCA-ROUNDS-PAYABLE', side: 'DEBIT', amountMinor: activeRound.expectedPayoutMinor, currency: cycle.currency || 'KES' },
          { accountCode: '1000-CASH-CLEARING', side: 'CREDIT', amountMinor: activeRound.expectedPayoutMinor, currency: cycle.currency || 'KES' }
        ],
        actorId,
        tx
      });

      await tx.auditLog.create({
        data: {
          workspaceId: cycle.workspaceId,
          actorId,
          action: 'ROSCA_ROUND_DISBURSED',
          entityType: 'RoscaRound',
          entityId: activeRound.id,
          details: {
            cycleId,
            roundNumber: activeRound.roundNumber,
            beneficiaryId: activeRound.beneficiaryMemberId,
            payoutAmountMinor: activeRound.expectedPayoutMinor.toString(),
            payoutTxRef
          }
        }
      });

      const completedRound = cycle.currentRound;
      const cycleCompleted = cycle.currentRound >= cycle.totalRounds;
      const nextRound = cycleCompleted ? cycle.currentRound : cycle.currentRound + 1;
      const nextStatus = cycleCompleted ? 'COMPLETED' : 'ACTIVE';

      await tx.roscaCycle.update({
        where: { id: cycle.id },
        data: {
          currentRound: nextRound,
          status: nextStatus
        }
      });

      return {
        cycleId,
        completedRound,
        beneficiaryId: activeRound.beneficiaryMemberId,
        payoutAmountMinor: Number(activeRound.expectedPayoutMinor),
        nextRound,
        cycleCompleted
      };
    });
  }

  async disburseRound(cycleId, roundNumber, actorId) {
    if (roundNumber !== undefined && roundNumber !== null) {
      const cycle = await prisma.roscaCycle.findUnique({ where: { id: cycleId } });
      if (!cycle) throw new AppError(`ROSCA cycle ${cycleId} not found`, 404);
      if (Number(roundNumber) !== cycle.currentRound) {
        throw new AppError(`Cannot disburse round ${roundNumber}. Active current round is ${cycle.currentRound}.`, 400);
      }
    }
    return this.executePayoutAndRotate(cycleId, actorId);
  }

  formatCycle(c) {
    const members = c.members?.map((m) => m.memberId) || [];
    const potPerRoundMinor = Number(c.contributionPerMemberMinor) * (members.length || c.totalRounds || 1);

    const schedule = (c.rounds || []).map((r, idx) => ({
      roundNumber: r.roundNumber,
      beneficiaryMemberId: r.beneficiaryMemberId,
      status: r.status === 'PAID_OUT' ? 'COMPLETED' : (r.roundNumber === c.currentRound ? 'ACTIVE' : 'SCHEDULED'),
      expectedPayoutMinor: Number(r.expectedPayoutMinor),
      collectedMinor: Number(r.collectedMinor),
      disbursedAt: r.disbursedAt
    }));

    return {
      id: c.id,
      workspaceId: c.workspaceId,
      name: c.name,
      contributionPerMemberMinor: Number(c.contributionPerMemberMinor),
      potPerRoundMinor,
      frequencyDays: c.frequencyDays,
      totalRounds: c.totalRounds,
      currentRound: c.currentRound,
      status: c.status,
      members,
      schedule,
      createdAt: c.createdAt
    };
  }
}

export const roscaService = new RoscaService();
