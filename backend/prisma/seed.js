import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('HesabuDemo!2026', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@hesabu.local' },
    update: {},
    create: { name: 'HESABU Demo', email: 'demo@hesabu.local', passwordHash }
  });
  let workspace = await prisma.workspace.findFirst({ where: { createdById: user.id, name: 'Campus Tech Conference' } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Campus Tech Conference', type: 'GROUP', currency: 'KES', createdById: user.id,
        memberships: { create: { userId: user.id, role: 'OWNER' } }
      }
    });
    await prisma.obligation.createMany({ data: [
      { workspaceId: workspace.id, title: 'Conference registration', memberName: 'Amina Wanjiku', amountMinor: 250000n, currency: 'KES' },
      { workspaceId: workspace.id, title: 'Conference registration', memberName: 'Brian Otieno', amountMinor: 250000n, currency: 'KES' },
      { workspaceId: workspace.id, title: 'Sponsor contribution', memberName: 'Tech Partner', amountMinor: 1000000n, currency: 'KES' }
    ]});
    await prisma.expense.create({
      data: { workspaceId: workspace.id, title: 'Venue deposit', category: 'Venue', amountMinor: 1500000n, currency: 'KES', submittedById: user.id, status: 'SUBMITTED' }
    });
  }
  console.log('Seed complete. Demo login: demo@hesabu.local / HesabuDemo!2026');
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
