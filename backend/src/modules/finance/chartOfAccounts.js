import { AppError } from '../../shared/errors.js';

export const ACCOUNT_CATEGORIES = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE'
};

export const NORMAL_BALANCES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT'
};

/**
 * Authoritative HESABU Enterprise Chart of Accounts (COA)
 * Designed for African SME, Group Chama, ROSCA, Table Banking & Multi-Currency Treasury Operations.
 */
export const CHART_OF_ACCOUNTS = {
  // 1000 Series: Assets
  '1000-CASH-CLEARING': {
    code: '1000-CASH-CLEARING',
    name: 'General Cash Clearing',
    category: ACCOUNT_CATEGORIES.ASSET,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Holding account for cash settlements and disbursements before clearing'
  },
  '1010-MPESA-CLEARING': {
    code: '1010-MPESA-CLEARING',
    name: 'Safaricom M-Pesa Mobile Money Clearing',
    category: ACCOUNT_CATEGORIES.ASSET,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'M-Pesa STK push and C2B payment settlements'
  },
  '1020-STELLAR-USDC': {
    code: '1020-STELLAR-USDC',
    name: 'Stellar On-Chain USDC Treasury',
    category: ACCOUNT_CATEGORIES.ASSET,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'On-chain Stellar stablecoin balances and settlement clearing'
  },
  '1030-PAYSHAP-CLEARING': {
    code: '1030-PAYSHAP-CLEARING',
    name: 'South Africa PayShap & Rapid EFT Clearing',
    category: ACCOUNT_CATEGORIES.ASSET,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'South African National Payment System PayShap & bank EFT settlements'
  },
  '1040-FX-CLEARING': {
    code: '1040-FX-CLEARING',
    name: 'Foreign Exchange Multi-Currency Clearing',
    category: ACCOUNT_CATEGORIES.ASSET,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Zero-balance clearing account for GAAP cross-currency conversions'
  },
  '1200-ACCOUNTS-RECEIVABLE': {
    code: '1200-ACCOUNTS-RECEIVABLE',
    name: 'Trade Accounts Receivable',
    category: ACCOUNT_CATEGORIES.ASSET,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Invoices issued to clients and corporate debtors'
  },
  '1300-LOANS-RECEIVABLE': {
    code: '1300-LOANS-RECEIVABLE',
    name: 'Table Banking Loans Principal Receivable',
    category: ACCOUNT_CATEGORIES.ASSET,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Disbursed table banking loans outstanding from members'
  },

  // 2000 Series: Liabilities
  '2000-ACCOUNTS-PAYABLE': {
    code: '2000-ACCOUNTS-PAYABLE',
    name: 'Trade Accounts Payable',
    category: ACCOUNT_CATEGORIES.LIABILITY,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Vendor bills and procurement payables pending payment'
  },
  '2100-CONTRIBUTIONS-PAYABLE': {
    code: '2100-CONTRIBUTIONS-PAYABLE',
    name: 'Member Savings & Contributions Held in Custody',
    category: ACCOUNT_CATEGORIES.LIABILITY,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Member Chama savings and welfare contributions held as fiduciary liabilities'
  },
  '2200-ROSCA-ROUNDS-PAYABLE': {
    code: '2200-ROSCA-ROUNDS-PAYABLE',
    name: 'ROSCA / Merry-Go-Round Pot Payable',
    category: ACCOUNT_CATEGORIES.LIABILITY,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Rotational pot funds accumulated and owed to round beneficiary'
  },
  '2300-TABLE-BANKING-DEPOSITS': {
    code: '2300-TABLE-BANKING-DEPOSITS',
    name: 'Member Share Capital & Deposits',
    category: ACCOUNT_CATEGORIES.LIABILITY,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Equity deposits contributed by members for table banking lending pool'
  },

  // 3000 Series: Equity
  '3000-RETAINED-EARNINGS': {
    code: '3000-RETAINED-EARNINGS',
    name: 'Retained Operating Surplus',
    category: ACCOUNT_CATEGORIES.EQUITY,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Accumulated surplus retained by the collective organisation'
  },
  '3100-MEMBER-CAPITAL': {
    code: '3100-MEMBER-CAPITAL',
    name: 'Permanent Member Capital Fund',
    category: ACCOUNT_CATEGORIES.EQUITY,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Non-refundable membership registrations and capital reserves'
  },

  // 4000 Series: Revenue
  '4000-REVENUE': {
    code: '4000-REVENUE',
    name: 'Operating Earned Revenue',
    category: ACCOUNT_CATEGORIES.REVENUE,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Sales of services, goods, and client invoices'
  },
  '4100-SERVICE-FEES': {
    code: '4100-SERVICE-FEES',
    name: 'Administrative & Membership Fees',
    category: ACCOUNT_CATEGORIES.REVENUE,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Subscription, fine, or onboarding fee income earned by the group'
  },
  '4200-LOAN-INTEREST-INCOME': {
    code: '4200-LOAN-INTEREST-INCOME',
    name: 'Table Banking Loan Interest Income',
    category: ACCOUNT_CATEGORIES.REVENUE,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Interest earned on table banking peer loans'
  },
  '4300-FX-GAIN': {
    code: '4300-FX-GAIN',
    name: 'Realized Foreign Exchange Gain',
    category: ACCOUNT_CATEGORIES.REVENUE,
    normalBalance: NORMAL_BALANCES.CREDIT,
    description: 'Currency conversion positive exchange rate gains'
  },

  // 5000 Series: Expenses
  '5000-OPERATING-EXPENSES': {
    code: '5000-OPERATING-EXPENSES',
    name: 'General & Administrative Expenses',
    category: ACCOUNT_CATEGORIES.EXPENSE,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'General operational expenditures and group overheads'
  },
  '5010-OFFICE-EXPENSES': {
    code: '5010-OFFICE-EXPENSES',
    name: 'Office & Facilities Expenses',
    category: ACCOUNT_CATEGORIES.EXPENSE,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Rent, stationery, utilities, and internet'
  },
  '5020-TRAVEL-EXPENSES': {
    code: '5020-TRAVEL-EXPENSES',
    name: 'Travel & Transport Expenses',
    category: ACCOUNT_CATEGORIES.EXPENSE,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Transportation, fuel, and lodging'
  },
  '5030-MARKETING-EXPENSES': {
    code: '5030-MARKETING-EXPENSES',
    name: 'Marketing & Outreach Expenses',
    category: ACCOUNT_CATEGORIES.EXPENSE,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Campaign promotions, events, and communications'
  },
  '5040-EQUIPMENT-EXPENSES': {
    code: '5040-EQUIPMENT-EXPENSES',
    name: 'Tools & Equipment Purchases',
    category: ACCOUNT_CATEGORIES.EXPENSE,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Procured equipment and operational machinery'
  },
  '5050-MEMBER-REIMBURSEMENTS': {
    code: '5050-MEMBER-REIMBURSEMENTS',
    name: 'Approved Member Out-of-Pocket Reimbursements',
    category: ACCOUNT_CATEGORIES.EXPENSE,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Direct disbursements compensating member expenditures'
  },
  '5060-LOAN-LOSS-PROVISION': {
    code: '5060-LOAN-LOSS-PROVISION',
    name: 'Doubtful Loans Provision Expense',
    category: ACCOUNT_CATEGORIES.EXPENSE,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Provisioning for delinquent or defaulted loans'
  },
  '5100-FX-LOSS': {
    code: '5100-FX-LOSS',
    name: 'Realized Foreign Exchange Loss',
    category: ACCOUNT_CATEGORIES.EXPENSE,
    normalBalance: NORMAL_BALANCES.DEBIT,
    description: 'Currency conversion negative exchange rate losses'
  }
};

/**
 * Validates whether an account code exists in the official Chart of Accounts
 * or conforms to authoritative 4-digit GAAP naming pattern (e.g. 1000-NAME).
 */
export function isValidAccountCode(code) {
  if (!code || typeof code !== 'string') return false;
  const clean = code.trim().toUpperCase();
  if (CHART_OF_ACCOUNTS[clean]) return true;
  return /^\d{4}-[A-Z0-9_-]+$/.test(clean);
}

export function assertValidAccountCode(code) {
  if (!isValidAccountCode(code)) {
    throw new AppError(`Invalid Chart of Accounts code "${code}". Must follow standard format (e.g. 1000-CASH-CLEARING).`, 400);
  }
}
