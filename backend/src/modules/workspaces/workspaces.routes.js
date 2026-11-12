import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { AppError, asyncHandler } from '../../shared/errors.js';
import { authenticate, requireWorkspaceRole, allowRoles } from '../../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.user.id },
    include: { workspace: true },
    orderBy: { joinedAt: 'asc' }
  });
  res.json({ workspaces: memberships.map(m => ({ ...m.workspace, role: m.role })) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = z.object({
    name: z.string().trim().min(2).max(100),
    type: z.enum(['PERSONAL', 'GROUP', 'COMMUNITY', 'SME', 'ORGANISATION']).default('GROUP'),
    currency: z.string().length(3).default('KES'),
    country: z.enum(['KE', 'ZA']).optional(),
    profile: z.enum(['GROUP', 'BUSINESS', 'ORGANISATION']).optional(),
    taxNumber: z.string().optional()
  }).parse(req.body);

  const currency = data.currency.toUpperCase();
  const country = data.country || (currency === 'ZAR' ? 'ZA' : 'KE');
  const vatRate = country === 'ZA' ? 0.15 : 0.16;
  const profile = data.profile || (data.type === 'SME' ? 'BUSINESS' : data.type === 'COMMUNITY' || data.type === 'GROUP' ? 'GROUP' : 'ORGANISATION');

  const workspace = await prisma.workspace.create({
    data: {
      name: data.name,
      type: data.type,
      currency,
      country,
      profile,
      vatRate,
      taxNumber: data.taxNumber || null,
      createdById: req.user.id,
      memberships: { create: { userId: req.user.id, role: 'OWNER' } }
    }
  });
  res.status(201).json({ workspace });
}));

router.get('/:id', requireWorkspaceRole, asyncHandler(async (req, res) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.id },
    include: { memberships: { include: { user: { select: { id: true, name: true, email: true } } } } }
  });
  res.json({ workspace });
}));

router.post('/:id/members', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN'), asyncHandler(async (req, res) => {
  const data = z.object({
    email: z.string().email().transform(v => v.toLowerCase()),
    role: z.enum(['ADMIN', 'FINANCE_MANAGER', 'APPROVER', 'MEMBER', 'AUDITOR'])
  }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new AppError('This user must register before being added.', 404);

  const member = await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: req.params.id } },
    update: { role: data.role },
    create: { userId: user.id, workspaceId: req.params.id, role: data.role }
  });
  res.status(201).json({ membership: member });
}));

router.delete('/:id/members/:memberId', requireWorkspaceRole, allowRoles('OWNER', 'ADMIN'), asyncHandler(async (req, res) => {
  const member = await prisma.membership.findUnique({ where: { id: req.params.memberId } });
  if (!member || member.workspaceId !== req.params.id) throw new AppError('Membership not found in this workspace.', 404);
  if (member.role === 'OWNER') throw new AppError('Workspace owner cannot be removed.', 400);

  await prisma.membership.delete({ where: { id: member.id } });
  res.json({ success: true, message: 'Member removed from workspace.' });
}));

export default router;
