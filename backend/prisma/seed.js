import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const STANDARD_ACCOUNTS = [
  { code: '1000', name: 'Petty Cash / Clearing', type: 'ASSET' },
  { code: '1010', name: 'M-Pesa Collections Clearing', type: 'ASSET' },
  { code: '1020', name: 'Stellar USDC Wallet', type: 'ASSET' },
  { code: '1030', name: 'South Africa Bank / PayShap Clearing', type: 'ASSET' },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2100', name: 'Member Contributions Payable', type: 'LIABILITY' },
  { code: '2200', name: 'ROSCA Pot Holding', type: 'LIABILITY' },
  { code: '3000', name: 'Group Capital & Retained Reserves', type: 'EQUITY' },
  { code: '4000', name: 'Commercial & Invoicing Revenue', type: 'REVENUE' },
  { code: '5000', name: 'General Operating Expenditure', type: 'EXPENSE' },
  { code: '5100', name: 'Logistics, Travel & Field Work', type: 'EXPENSE' }
];

async function seedChartOfAccounts(workspaceId, currency) {
  for (const acc of STANDARD_ACCOUNTS) {
    await prisma.chartOfAccount.upsert({
      where: { workspaceId_code: { workspaceId, code: acc.code } },
      update: {},
      create: {
        workspaceId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        currency,
        isSystem: true
      }
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash('HesabuDemo!2026', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@hesabu.local' },
    update: {},
    create: { name: 'HESABU Demo Administrator', email: 'demo@hesabu.local', passwordHash }
  });

  // 1. Kenya Chama Workspace
  let keWs = await prisma.workspace.findFirst({ where: { createdById: user.id, name: 'Ushirika Chama Savings' } });
  if (!keWs) {
    keWs = await prisma.workspace.create({
      data: {
        name: 'Ushirika Chama Savings',
        type: 'GROUP',
        profile: 'GROUP',
        country: 'KE',
        currency: 'KES',
        spendingThresholdMinor: 5000000n,
        createdById: user.id,
        memberships: { create: { userId: user.id, role: 'OWNER' } }
      }
    });
  }
  await seedChartOfAccounts(keWs.id, 'KES');

  const member = await prisma.membership.findFirst({ where: { workspaceId: keWs.id, userId: user.id } });

  // Obligations
  const existingObl = await prisma.obligation.findFirst({ where: { workspaceId: keWs.id } });
  if (!existingObl) {
    await prisma.obligation.createMany({
      data: [
        { workspaceId: keWs.id, memberId: member?.id, title: 'November Chama Dues', memberName: 'Amina Wanjiku', amountMinor: 500000n, currency: 'KES' },
        { workspaceId: keWs.id, memberId: member?.id, title: 'November Chama Dues', memberName: 'Brian Otieno', amountMinor: 500000n, currency: 'KES' },
        { workspaceId: keWs.id, memberId: member?.id, title: 'Emergency Welfare Fund', memberName: 'David Kimani', amountMinor: 200000n, currency: 'KES' }
      ]
    });
  }

  // Persistent ROSCA
  const existingRosca = await prisma.roscaCycle.findFirst({ where: { workspaceId: keWs.id } });
  if (!existingRosca) {
    const cycle = await prisma.roscaCycle.create({
      data: {
        workspaceId: keWs.id,
        name: 'Ushirika Round Robin 2026',
        contributionPerMemberMinor: 500000n,
        currency: 'KES',
        frequencyDays: 30,
        status: 'ACTIVE',
        currentRound: 1,
        totalRounds: 3,
        members: {
          create: [
            { memberId: 'mem_amina_01', position: 1 },
            { memberId: 'mem_brian_02', position: 2 },
            { memberId: 'mem_david_03', position: 3 }
          ]
        },
        rounds: {
          create: [
            { roundNumber: 1, beneficiaryMemberId: 'mem_amina_01', expectedPayoutMinor: 1500000n, status: 'PENDING' },
            { roundNumber: 2, beneficiaryMemberId: 'mem_brian_02', expectedPayoutMinor: 1500000n, status: 'PENDING' },
            { roundNumber: 3, beneficiaryMemberId: 'mem_david_03', expectedPayoutMinor: 1500000n, status: 'PENDING' }
          ]
        }
      }
    });
  }

  // 2. South Africa Business Workspace
  let zaWs = await prisma.workspace.findFirst({ where: { createdById: user.id, name: 'FinNexus Cape Town SME' } });
  if (!zaWs) {
    zaWs = await prisma.workspace.create({
      data: {
        name: 'FinNexus Cape Town SME',
        type: 'SME',
        profile: 'BUSINESS',
        country: 'ZA',
        currency: 'ZAR',
        taxNumber: 'ZA4910294821',
        vatRate: 0.15,
        spendingThresholdMinor: 2000000n,
        createdById: user.id,
        memberships: { create: { userId: user.id, role: 'OWNER' } }
      }
    });
  }
  await seedChartOfAccounts(zaWs.id, 'ZAR');

  // Customer & Invoices
  const customer = await prisma.customer.upsert({
    where: { workspaceId_email: { workspaceId: zaWs.id, email: 'procurement@africatech.co.za' } },
    update: {},
    create: {
      workspaceId: zaWs.id,
      name: 'Africa Tech Solutions Pty Ltd',
      email: 'procurement@africatech.co.za',
      phone: '+27821234567',
      taxId: '4710294812',
      address: 'V&A Waterfront, Cape Town, 8001'
    }
  });

  const existingInvoice = await prisma.invoice.findFirst({ where: { workspaceId: zaWs.id } });
  if (!existingInvoice) {
    await prisma.invoice.create({
      data: {
        workspaceId: zaWs.id,
        customerId: customer.id,
        invoiceNumber: 'INV-ZA-2026-001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
        currency: 'ZAR',
        subtotalMinor: 8500000n,
        taxMinor: 1275000n,
        totalMinor: 9775000n,
        status: 'SENT',
        notes: 'Financial Operations Integration and Verification Consulting',
        lines: {
          create: [
            { description: 'Payment Orchestration Integration', quantity: 1, unitPriceMinor: 5000000n, amountMinor: 5000000n },
            { description: 'Audit Reconciliation & Compliance Architecture', quantity: 1, unitPriceMinor: 3500000n, amountMinor: 3500000n }
          ]
        }
      }
    });
  }

  // Supplier & Bill
  const supplier = await prisma.supplier.upsert({
    where: { workspaceId_email: { workspaceId: zaWs.id, email: 'billing@cloudscale.co.za' } },
    update: {},
    create: {
      workspaceId: zaWs.id,
      name: 'CloudScale Infrastructure Africa',
      email: 'billing@cloudscale.co.za',
      phone: '+27219876543',
      bankName: 'Standard Bank',
      bankAccount: '1012948214',
      taxId: '4820194821',
      address: 'Century City, Cape Town'
    }
  });

  const existingBill = await prisma.supplierBill.findFirst({ where: { workspaceId: zaWs.id } });
  if (!existingBill) {
    await prisma.supplierBill.create({
      data: {
        workspaceId: zaWs.id,
        supplierId: supplier.id,
        billNumber: 'BILL-CS-94821',
        dueDate: new Date(Date.now() + 7 * 86400000),
        currency: 'ZAR',
        amountMinor: 3200000n,
        status: 'PENDING_APPROVAL',
        category: 'INFRASTRUCTURE',
        notes: 'Dedicated Sovereign Cloud Node Hosting'
      }
    });
  }

  console.log('Seed complete. Demo login: demo@hesabu.local / HesabuDemo!2026');
  console.log(`Kenya Chama Workspace: ${keWs.id}`);
  console.log(`South Africa SME Workspace: ${zaWs.id}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
