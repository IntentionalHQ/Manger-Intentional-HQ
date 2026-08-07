import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBalanceSheet,
  buildProfitAndLoss,
  journalTotals,
  validateJournalEntry,
} from "../app/finance/ledger.ts";
import {
  buildScaleScenarios,
  defaultProjectionInput,
  projectCosts,
} from "../app/finance/projection.ts";
import { currentAccountingPeriod } from "../app/finance/period.ts";

const accounts = [
  { id: "cash", code: "1000", name: "Cash", type: "asset", subtype: "cash", active: true },
  { id: "equity", code: "3000", name: "Equity", type: "equity", subtype: "capital", active: true },
  { id: "revenue", code: "4000", name: "Revenue", type: "revenue", subtype: "revenue", active: true },
  { id: "expense", code: "6000", name: "Expense", type: "expense", subtype: "expense", active: true },
];

const entries = [
  {
    id: "opening", entryNumber: 1, entryDate: "2026-08-01", memo: "Opening",
    status: "posted", sourceType: "opening_balance", postedAt: "2026-08-01T12:00:00Z",
    lines: [
      { id: "1", accountId: "cash", debitCents: 100_000, creditCents: 0 },
      { id: "2", accountId: "equity", debitCents: 0, creditCents: 100_000 },
    ],
  },
  {
    id: "sale", entryNumber: 2, entryDate: "2026-08-10", memo: "Sale",
    status: "posted", sourceType: "manual", postedAt: "2026-08-10T12:00:00Z",
    lines: [
      { id: "3", accountId: "cash", debitCents: 50_000, creditCents: 0 },
      { id: "4", accountId: "revenue", debitCents: 0, creditCents: 50_000 },
    ],
  },
  {
    id: "bill", entryNumber: 3, entryDate: "2026-08-12", memo: "Bill",
    status: "posted", sourceType: "manual", postedAt: "2026-08-12T12:00:00Z",
    lines: [
      { id: "5", accountId: "expense", debitCents: 12_500, creditCents: 0 },
      { id: "6", accountId: "cash", debitCents: 0, creditCents: 12_500 },
    ],
  },
];

test("journal validation rejects unbalanced and malformed entries", () => {
  assert.deepEqual(validateJournalEntry(entries[0]), []);
  assert.deepEqual(journalTotals(entries[0]), { debitCents: 100_000, creditCents: 100_000 });
  const broken = structuredClone(entries[0]);
  broken.lines[1].creditCents = 99_999;
  assert.match(validateJournalEntry(broken).join(" "), /balance/i);
});

test("financial statements preserve the accounting equation", () => {
  const pnl = buildProfitAndLoss(accounts, entries, "2026-08-01", "2026-08-31");
  assert.equal(pnl.totalRevenueCents, 50_000);
  assert.equal(pnl.totalExpenseCents, 12_500);
  assert.equal(pnl.netIncomeCents, 37_500);
  const balance = buildBalanceSheet(accounts, entries, "2026-08-31");
  assert.equal(balance.totalAssetsCents, 137_500);
  assert.equal(balance.totalEquityCents, 137_500);
  assert.equal(balance.differenceCents, 0);
});

test("reversals preserve history while cancelling the original economics", () => {
  const original = structuredClone(entries[2]);
  original.status = "reversed";
  const reversal = {
    id: "reversal", entryNumber: 4, entryDate: "2026-08-13", memo: "Reversal: duplicate bill",
    status: "posted", sourceType: "reversal", postedAt: "2026-08-13T12:00:00Z",
    lines: original.lines.map((line, index) => ({
      id: `reversal-${index}`,
      accountId: line.accountId,
      debitCents: line.creditCents,
      creditCents: line.debitCents,
    })),
  };
  const corrected = [entries[0], entries[1], original, reversal];
  const pnl = buildProfitAndLoss(accounts, corrected, "2026-08-01", "2026-08-31");
  const balance = buildBalanceSheet(accounts, corrected, "2026-08-31");
  assert.equal(pnl.totalExpenseCents, 0);
  assert.equal(pnl.netIncomeCents, 50_000);
  assert.equal(balance.differenceCents, 0);
});

test("the default cost model matches the audited workbook scenario", () => {
  const result = projectCosts(defaultProjectionInput);
  assert.equal(result.activeUsers, 40_000);
  assert.equal(result.monthlyRevenueCents, 2_990_000);
  assert.equal(result.totalMonthlyCostCents, 442_834);
  assert.equal(result.netCashCents, 2_547_166);
  assert.equal(result.costPerPayingUserCents, 44);
  assert.equal(result.breakEvenPayingUsers, 26);
});

test("scale scenarios remain ordered and formula-driven", () => {
  const scenarios = buildScaleScenarios(defaultProjectionInput);
  assert.deepEqual(scenarios.map((row) => row.input.payingUsers), [100, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000]);
  for (let index = 1; index < scenarios.length; index += 1) {
    assert.ok(scenarios[index].monthlyRevenueCents > scenarios[index - 1].monthlyRevenueCents);
    assert.ok(scenarios[index].totalMonthlyCostCents >= scenarios[index - 1].totalMonthlyCostCents);
  }
});

test("accounting periods respect the configured business time zone", () => {
  const period = currentAccountingPeriod(new Date("2026-08-01T02:00:00Z"), "America/New_York");
  assert.deepEqual(period, {
    start: "2026-07-01",
    end: "2026-07-31",
    label: "July 2026",
    asOfDate: "2026-07-31",
  });
});
