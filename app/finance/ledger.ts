import type {
  AccountBalance,
  BalanceSheet,
  JournalEntry,
  LedgerAccount,
  ProfitAndLoss,
} from "./types";

const debitNormal = new Set(["asset", "expense"]);

function postedThrough(entries: JournalEntry[], through?: string) {
  return entries.filter(
    (entry) =>
      (entry.status === "posted" || entry.status === "reversed") &&
      (!through || entry.entryDate <= through),
  );
}

export function journalTotals(entry: JournalEntry) {
  return entry.lines.reduce(
    (totals, line) => ({
      debitCents: totals.debitCents + line.debitCents,
      creditCents: totals.creditCents + line.creditCents,
    }),
    { debitCents: 0, creditCents: 0 },
  );
}

export function validateJournalEntry(entry: JournalEntry): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.entryDate)) {
    errors.push("Entry date must use YYYY-MM-DD.");
  }
  if (entry.lines.length < 2) errors.push("An entry needs at least two lines.");
  for (const line of entry.lines) {
    if (!Number.isSafeInteger(line.debitCents) || !Number.isSafeInteger(line.creditCents)) {
      errors.push("Journal amounts must use whole cents.");
    }
    if (line.debitCents < 0 || line.creditCents < 0) {
      errors.push("Journal amounts cannot be negative.");
    }
    if ((line.debitCents > 0) === (line.creditCents > 0)) {
      errors.push("Each line must contain either a debit or a credit.");
    }
  }
  const totals = journalTotals(entry);
  if (totals.debitCents !== totals.creditCents) {
    errors.push("Debits and credits must balance.");
  }
  return [...new Set(errors)];
}

export function buildTrialBalance(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  through?: string,
): AccountBalance[] {
  const totals = new Map<string, { debitCents: number; creditCents: number }>();
  for (const entry of postedThrough(entries, through)) {
    for (const line of entry.lines) {
      const current = totals.get(line.accountId) ?? { debitCents: 0, creditCents: 0 };
      current.debitCents += line.debitCents;
      current.creditCents += line.creditCents;
      totals.set(line.accountId, current);
    }
  }

  return accounts
    .filter((account) => account.active)
    .map((account) => {
      const total = totals.get(account.id) ?? { debitCents: 0, creditCents: 0 };
      const balanceCents = debitNormal.has(account.type)
        ? total.debitCents - total.creditCents
        : total.creditCents - total.debitCents;
      return { ...account, ...total, balanceCents };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function buildProfitAndLoss(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  start: string,
  end: string,
): ProfitAndLoss {
  const periodEntries = entries.filter(
    (entry) => entry.entryDate >= start && entry.entryDate <= end,
  );
  const balances = buildTrialBalance(accounts, periodEntries, end);
  const revenue = balances.filter((account) => account.type === "revenue" && account.balanceCents !== 0);
  const expenses = balances.filter((account) => account.type === "expense" && account.balanceCents !== 0);
  const totalRevenueCents = revenue.reduce((sum, account) => sum + account.balanceCents, 0);
  const totalExpenseCents = expenses.reduce((sum, account) => sum + account.balanceCents, 0);
  return {
    revenue,
    expenses,
    totalRevenueCents,
    totalExpenseCents,
    netIncomeCents: totalRevenueCents - totalExpenseCents,
  };
}

export function buildBalanceSheet(
  accounts: LedgerAccount[],
  entries: JournalEntry[],
  through: string,
): BalanceSheet {
  const balances = buildTrialBalance(accounts, entries, through);
  const assets = balances.filter((account) => account.type === "asset" && account.balanceCents !== 0);
  const liabilities = balances.filter((account) => account.type === "liability" && account.balanceCents !== 0);
  const equity = balances.filter((account) => account.type === "equity" && account.balanceCents !== 0);
  const totalAssetsCents = assets.reduce((sum, account) => sum + account.balanceCents, 0);
  const totalLiabilitiesCents = liabilities.reduce((sum, account) => sum + account.balanceCents, 0);
  const statedEquityCents = equity.reduce((sum, account) => sum + account.balanceCents, 0);
  const totalRevenueCents = balances
    .filter((account) => account.type === "revenue")
    .reduce((sum, account) => sum + account.balanceCents, 0);
  const totalExpenseCents = balances
    .filter((account) => account.type === "expense")
    .reduce((sum, account) => sum + account.balanceCents, 0);
  const currentEarningsCents = totalRevenueCents - totalExpenseCents;
  const totalEquityCents = statedEquityCents + currentEarningsCents;
  return {
    assets,
    liabilities,
    equity,
    totalAssetsCents,
    totalLiabilitiesCents,
    statedEquityCents,
    currentEarningsCents,
    totalEquityCents,
    differenceCents: totalAssetsCents - totalLiabilitiesCents - totalEquityCents,
  };
}
