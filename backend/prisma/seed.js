import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { initializeWorkspaceChartOfAccounts } from '../src/modules/finance/chartOfAccounts.js';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail.toLowerCase().trim() },
      update: {},
      create: {
        name: process.env.INITIAL_ADMIN_NAME || 'Platform Administrator',
        email: adminEmail.toLowerCase().trim(),
        passwordHash
      }
    });
    console.log(`Initial administrator provisioned: ${adminEmail}`);
  }

  // Ensure all existing workspaces have their authoritative GAAP Chart of Accounts initialized
  const workspaces = await prisma.workspace.findMany();
  for (const ws of workspaces) {
    await initializeWorkspaceChartOfAccounts(ws.id, ws.currency, prisma);
  }

  console.log(`System initialization complete. ${workspaces.length} workspace(s) verified.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
