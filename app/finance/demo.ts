import { buildBalanceSheet, buildProfitAndLoss, buildTrialBalance } from "./ledger";
import { defaultProjectionInput } from "./projection";
import { currentAccountingPeriod } from "./period";
import type { FinanceWorkspace, JournalEntry, LedgerAccount } from "./types";

export const demoAccounts: LedgerAccount[] = [
  { id: "cash", code: "1000", name: "Operating cash", type: "asset", subtype: "cash", active: true },
  { id: "receivables", code: "1100", name: "Accounts receivable", type: "asset", subtype: "receivable", active: true },
  { id: "payables", code: "2000", name: "Accounts payable", type: "liability", subtype: "payable", active: true },
  { id: "owner-equity", code: "3000", name: "Founder contributions", type: "equity", subtype: "contributed_capital", active: true },
  { id: "revenue", code: "4000", name: "Subscription revenue", type: "revenue", subtype: "operating_revenue", active: true },
  { id: "stripe-fees", code: "6100", name: "Payment processing", type: "expense", subtype: "cost_of_revenue", active: true },
  { id: "supabase", code: "6200", name: "Hosting — Supabase", type: "expense", subtype: "hosting", active: true },
  { id: "vercel", code: "6210", name: "Hosting — Vercel", type: "expense", subtype: "hosting", active: true },
  { id: "email", code: "6220", name: "Transactional email", type: "expense", subtype: "software", active: true },
  { id: "contractors", code: "6300", name: "Contractors", type: "expense", subtype: "people", active: true },
  { id: "legal", code: "6400", name: "Legal and professional", type: "expense", subtype: "professional_services", active: true },
];

function dateInPeriod(period: ReturnType<typeof currentAccountingPeriod>, day: number) {
  const asOfDay = Number(period.asOfDate.slice(-2));
  return `${period.start.slice(0, 8)}${String(Math.min(day, asOfDay)).padStart(2, "0")}`;
}

function twoLineEntry(
  id: string,
  entryNumber: number,
  entryDate: string,
  memo: string,
  debitAccount: string,
  creditAccount: string,
  cents: number,
  sourceType: JournalEntry["sourceType"] = "manual",
): JournalEntry {
  return {
    id,
    entryNumber,
    entryDate,
    memo,
    status: "posted",
    sourceType,
    postedAt: `${entryDate}T16:00:00.000Z`,
    lines: [
      { id: `${id}-dr`, accountId: debitAccount, debitCents: cents, creditCents: 0 },
      { id: `${id}-cr`, accountId: creditAccount, debitCents: 0, creditCents: cents },
    ],
  };
}

export function buildDemoFinanceWorkspace(date = new Date()): FinanceWorkspace {
  const period = currentAccountingPeriod(date);
  const entries: JournalEntry[] = [
    twoLineEntry("opening", 1, dateInPeriod(period, 1), "Founder funding", "cash", "owner-equity", 2_000_000, "opening_balance"),
    twoLineEntry("revenue-1", 2, dateInPeriod(period, 2), "Subscription receipts", "cash", "revenue", 2_990_000, "bank_import"),
    twoLineEntry("stripe-1", 3, dateInPeriod(period, 3), "Stripe processing fees", "stripe-fees", "cash", 386_710, "bank_import"),
    twoLineEntry("supabase-1", 4, dateInPeriod(period, 4), "Supabase platform and usage", "supabase", "cash", 18_053, "bank_import"),
    twoLineEntry("vercel-1", 5, dateInPeriod(period, 5), "Vercel platform and usage", "vercel", "cash", 29_771, "bank_import"),
    twoLineEntry("email-1", 6, dateInPeriod(period, 6), "Transactional email", "email", "cash", 8_300, "bank_import"),
  ];
  const profitAndLoss = buildProfitAndLoss(demoAccounts, entries, period.start, period.asOfDate);
  return {
    mode: "preview",
    message: "Preview data is shown because the Intentional HQ database is not connected yet.",
    business: {
      id: "preview-business",
      name: "Intentional Labs — preview",
      currency: "USD",
      fiscalYearStartMonth: 1,
    },
    period: { start: period.start, end: period.end, label: period.label },
    asOfDate: period.asOfDate,
    accounts: demoAccounts,
    entries,
    profitAndLoss,
    balanceSheet: buildBalanceSheet(demoAccounts, entries, period.asOfDate),
    trialBalance: buildTrialBalance(demoAccounts, entries, period.asOfDate),
    projectionInput: { ...defaultProjectionInput },
    actualOperatingCostCents: profitAndLoss.totalExpenseCents,
    unreconciledCount: 6,
    lastClosedThrough: null,
  };
}
