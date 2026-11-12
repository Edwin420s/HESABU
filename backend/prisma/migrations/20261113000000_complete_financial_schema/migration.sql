-- CreateEnum
CREATE TYPE "WorkspaceProfile" AS ENUM ('GROUP', 'BUSINESS', 'ORGANISATION');

-- CreateEnum
CREATE TYPE "WorkspaceCountry" AS ENUM ('KE', 'ZA');

-- CreateEnum
CREATE TYPE "JournalSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "RoscaCycleStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoscaRoundStatus" AS ENUM ('PENDING', 'FUNDED', 'PAID_OUT');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'REPAID', 'DEFAULTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoanInterestType" AS ENUM ('FLAT', 'REDUCING_BALANCE');

-- CreateEnum
CREATE TYPE "ReconStatus" AS ENUM ('MATCHED', 'UNRESOLVED', 'DISCREPANCY', 'IGNORED');

-- CreateEnum
CREATE TYPE "FXQuoteStatus" AS ENUM ('ACTIVE', 'LOCKED', 'EXECUTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "PaymentRail" ADD VALUE 'PAYSHAP_EFT';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'DISPUTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkspaceType" ADD VALUE 'COMMUNITY';
ALTER TYPE "WorkspaceType" ADD VALUE 'SME';

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_obligationId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_obligationId_fkey";

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "periodMonth" INTEGER,
ADD COLUMN     "periodYear" INTEGER,
ADD COLUMN     "reversedEntryId" TEXT;

-- AlterTable
ALTER TABLE "Obligation" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "memberId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "assetCode" TEXT,
ADD COLUMN     "assetIssuer" TEXT,
ADD COLUMN     "checkoutRequestId" TEXT,
ADD COLUMN     "destinationAccount" TEXT,
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "merchantRequestId" TEXT,
ADD COLUMN     "mpesaReceiptNumber" TEXT,
ALTER COLUMN "obligationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "invoiceId" TEXT,
ALTER COLUMN "obligationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "country" "WorkspaceCountry" NOT NULL DEFAULT 'KE',
ADD COLUMN     "profile" "WorkspaceProfile" NOT NULL DEFAULT 'GROUP',
ADD COLUMN     "spendingThresholdMinor" BIGINT,
ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "vatRate" DECIMAL(65,30) DEFAULT 0.16,
ALTER COLUMN "type" SET DEFAULT 'GROUP';

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetAmountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "paymentId" TEXT,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "signature" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationCase" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "ReconStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "settlementId" TEXT,
    "obligationId" TEXT,
    "invoiceId" TEXT,
    "expectedAmountMinor" BIGINT,
    "settledAmountMinor" BIGINT,
    "discrepancyMinor" BIGINT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseSplit" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "memberEmail" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "percentage" DECIMAL(65,30),
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseApproval" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "expenseId" TEXT,
    "claimantId" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "paymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSchedule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "idempotencyPrefix" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementAnchor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "merkleRootHash" TEXT NOT NULL,
    "txHash" TEXT,
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "contractAddress" TEXT,
    "publisherAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ANCHORED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatementAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "subtotalMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "paidMinor" BIGINT NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPriceMinor" BIGINT NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBill" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "amountMinor" BIGINT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "category" TEXT NOT NULL DEFAULT 'OPERATING',
    "receiptUrl" TEXT,
    "notes" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "department" TEXT NOT NULL DEFAULT 'GENERAL',
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoscaCycle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contributionPerMemberMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "frequencyDays" INTEGER NOT NULL DEFAULT 30,
    "status" "RoscaCycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "totalRounds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoscaCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoscaMember" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoscaMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoscaRound" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "beneficiaryMemberId" TEXT NOT NULL,
    "expectedPayoutMinor" BIGINT NOT NULL,
    "collectedMinor" BIGINT NOT NULL DEFAULT 0,
    "status" "RoscaRoundStatus" NOT NULL DEFAULT 'PENDING',
    "disbursedAt" TIMESTAMP(3),
    "payoutTxRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoscaRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableLoan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "borrowerMemberId" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "principalMinor" BIGINT NOT NULL,
    "interestRatePercent" DECIMAL(65,30) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "interestType" "LoanInterestType" NOT NULL DEFAULT 'FLAT',
    "totalInterestMinor" BIGINT NOT NULL,
    "totalPayableMinor" BIGINT NOT NULL,
    "monthlyPaymentMinor" BIGINT NOT NULL,
    "balanceMinor" BIGINT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "paymentRef" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'MONTHLY',
    "allocatedMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "alertThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FXQuote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "quoteRef" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "spread" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sourceAmountMinor" BIGINT NOT NULL,
    "targetAmountMinor" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "FXQuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT NOT NULL DEFAULT 'HESABU_FX',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FXQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FXConversion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "sourceAmountMinor" BIGINT NOT NULL,
    "targetAmountMinor" BIGINT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "feesMinor" BIGINT NOT NULL DEFAULT 0,
    "settlementRef" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FXConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceAllocation" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "settlementId" TEXT,
    "paymentId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "creditNoteNumber" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "subtotalMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNoteLine" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanScheduleRow" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalDueMinor" BIGINT NOT NULL,
    "interestDueMinor" BIGINT NOT NULL,
    "totalDueMinor" BIGINT NOT NULL,
    "principalPaidMinor" BIGINT NOT NULL DEFAULT 0,
    "interestPaidMinor" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "LoanScheduleRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChartOfAccount_workspaceId_type_idx" ON "ChartOfAccount"("workspaceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_workspaceId_code_key" ON "ChartOfAccount"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_status_idx" ON "Campaign"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEvent_externalId_key" ON "ProviderEvent"("externalId");

-- CreateIndex
CREATE INDEX "ProviderEvent_workspaceId_provider_idx" ON "ProviderEvent"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationCase_settlementId_key" ON "ReconciliationCase"("settlementId");

-- CreateIndex
CREATE INDEX "ReconciliationCase_workspaceId_status_idx" ON "ReconciliationCase"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Reimbursement_workspaceId_status_idx" ON "Reimbursement"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Customer_workspaceId_idx" ON "Customer"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_workspaceId_email_key" ON "Customer"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Supplier_workspaceId_idx" ON "Supplier"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_workspaceId_email_key" ON "Supplier"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Invoice_workspaceId_status_idx" ON "Invoice"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_workspaceId_invoiceNumber_key" ON "Invoice"("workspaceId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "SupplierBill_workspaceId_status_idx" ON "SupplierBill"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierBill_workspaceId_billNumber_key" ON "SupplierBill"("workspaceId", "billNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequest_workspaceId_status_idx" ON "PurchaseRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "RoscaCycle_workspaceId_status_idx" ON "RoscaCycle"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoscaMember_cycleId_memberId_key" ON "RoscaMember"("cycleId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "RoscaRound_cycleId_roundNumber_key" ON "RoscaRound"("cycleId", "roundNumber");

-- CreateIndex
CREATE INDEX "TableLoan_workspaceId_status_idx" ON "TableLoan"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Budget_workspaceId_idx" ON "Budget"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_workspaceId_category_period_key" ON "Budget"("workspaceId", "category", "period");

-- CreateIndex
CREATE UNIQUE INDEX "FXQuote_quoteRef_key" ON "FXQuote"("quoteRef");

-- CreateIndex
CREATE INDEX "FXQuote_workspaceId_status_idx" ON "FXQuote"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "FXConversion_workspaceId_idx" ON "FXConversion"("workspaceId");

-- CreateIndex
CREATE INDEX "InvoiceAllocation_invoiceId_idx" ON "InvoiceAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceAllocation_settlementId_idx" ON "InvoiceAllocation"("settlementId");

-- CreateIndex
CREATE INDEX "CreditNote_workspaceId_idx" ON "CreditNote"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_workspaceId_creditNoteNumber_key" ON "CreditNote"("workspaceId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "LoanScheduleRow_loanId_status_idx" ON "LoanScheduleRow"("loanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoanScheduleRow_loanId_installmentNumber_key" ON "LoanScheduleRow"("loanId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversedEntryId_key" ON "JournalEntry"("reversedEntryId");

-- CreateIndex
CREATE INDEX "Obligation_memberId_idx" ON "Obligation"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_checkoutRequestId_key" ON "Payment"("checkoutRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_mpesaReceiptNumber_key" ON "Payment"("mpesaReceiptNumber");

-- CreateIndex
CREATE INDEX "Payment_checkoutRequestId_idx" ON "Payment"("checkoutRequestId");

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEvent" ADD CONSTRAINT "ProviderEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEvent" ADD CONSTRAINT "ProviderEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseSplit" ADD CONSTRAINT "ExpenseSplit_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseApproval" ADD CONSTRAINT "ExpenseApproval_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementAnchor" ADD CONSTRAINT "StatementAnchor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoscaCycle" ADD CONSTRAINT "RoscaCycle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoscaMember" ADD CONSTRAINT "RoscaMember_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RoscaCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoscaRound" ADD CONSTRAINT "RoscaRound_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RoscaCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableLoan" ADD CONSTRAINT "TableLoan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepayment" ADD CONSTRAINT "LoanRepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "TableLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FXQuote" ADD CONSTRAINT "FXQuote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FXConversion" ADD CONSTRAINT "FXConversion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FXConversion" ADD CONSTRAINT "FXConversion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "FXQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAllocation" ADD CONSTRAINT "InvoiceAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAllocation" ADD CONSTRAINT "InvoiceAllocation_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceAllocation" ADD CONSTRAINT "InvoiceAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanScheduleRow" ADD CONSTRAINT "LoanScheduleRow_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "TableLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

