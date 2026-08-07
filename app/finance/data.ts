import "server-only";

import { createHQAdminClient, isHQDatabaseConfigured } from "@/lib/supabase/hq-admin";
import { buildBalanceSheet, buildProfitAndLoss, buildTrialBalance } from "./ledger";
import { buildDemoFinanceWorkspace } from "./demo";
import { currentAccountingPeriod } from "./period";
import { defaultProjectionInput } from "./projection";
import type { CostProjectionInput, FinanceWorkspace, JournalEntry, LedgerAccount } from "./types";

function emptyWorkspace(message: string): FinanceWorkspace {
  const period = currentAccountingPeriod();
  const accounts: LedgerAccount[] = [];
  const entries: JournalEntry[] = [];
  return {
    mode: "setup_required",
    message,
    business: { id: "", name: "Your company", currency: "USD", fiscalYearStartMonth: 1 },
    period: { start: period.start, end: period.end, label: period.label },
    asOfDate: period.asOfDate,
    accounts,
    entries,
    profitAndLoss: buildProfitAndLoss(accounts, entries, period.start, period.asOfDate),
    balanceSheet: buildBalanceSheet(accounts, entries, period.asOfDate),
    trialBalance: buildTrialBalance(accounts, entries, period.asOfDate),
    projectionInput: { ...defaultProjectionInput },
    actualOperatingCostCents: 0,
    unreconciledCount: 0,
    lastClosedThrough: null,
  };
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getFinanceWorkspace(ownerEmail: string): Promise<FinanceWorkspace> {
  if (!isHQDatabaseConfigured()) return buildDemoFinanceWorkspace();

  const client = createHQAdminClient();
  const { data: business, error: businessError } = await client
    .from("hq_businesses")
    .select("id,name,currency,fiscal_year_start_month")
    .eq("owner_email", ownerEmail.toLowerCase())
    .maybeSingle();

  if (businessError) {
    const missing = businessError.code === "42P01" || businessError.code === "PGRST205";
    return emptyWorkspace(
      missing
        ? "The HQ database is connected, but the finance migration has not been applied."
        : "The HQ database connected, but the finance workspace could not be read.",
    );
  }
  if (!business) {
    return emptyWorkspace("The HQ database is connected. Create your company books to begin.");
  }

  const businessId = String(business.id);
  const [accountsResult, entriesResult, linesResult, scenarioResult, sourceResult, periodsResult] =
    await Promise.all([
      client.from("hq_chart_accounts").select("id,code,name,type,subtype,active").eq("business_id", businessId).order("code"),
      client.from("hq_journal_entries").select("id,entry_number,entry_date,memo,status,source_type,posted_at").eq("business_id", businessId).order("entry_date", { ascending: false }).order("entry_number", { ascending: false }),
      client.from("hq_journal_lines").select("id,entry_id,account_id,debit_cents,credit_cents,description").eq("business_id", businessId),
      client.from("hq_forecast_scenarios").select("assumptions").eq("business_id", businessId).eq("is_default", true).maybeSingle(),
      client.from("hq_source_transactions").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("review_status", "unreviewed"),
      client.from("hq_fiscal_periods").select("end_date").eq("business_id", businessId).eq("status", "closed").order("end_date", { ascending: false }).limit(1),
    ]);

  const firstError = [accountsResult.error, entriesResult.error, linesResult.error].find(Boolean);
  if (firstError) return emptyWorkspace("The finance database schema is incomplete. Re-run the HQ finance migration.");

  const accounts: LedgerAccount[] = (accountsResult.data ?? []).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    type: row.type as LedgerAccount["type"],
    subtype: String(row.subtype ?? ""),
    active: Boolean(row.active),
  }));
  const linesByEntry = new Map<string, JournalEntry["lines"]>();
  for (const row of linesResult.data ?? []) {
    const entryId = String(row.entry_id);
    const lines = linesByEntry.get(entryId) ?? [];
    lines.push({
      id: String(row.id),
      accountId: String(row.account_id),
      debitCents: numberValue(row.debit_cents),
      creditCents: numberValue(row.credit_cents),
      description: row.description ? String(row.description) : undefined,
    });
    linesByEntry.set(entryId, lines);
  }
  const entries: JournalEntry[] = (entriesResult.data ?? []).map((row) => ({
    id: String(row.id),
    entryNumber: numberValue(row.entry_number),
    entryDate: String(row.entry_date),
    memo: String(row.memo),
    status: row.status as JournalEntry["status"],
    sourceType: row.source_type as JournalEntry["sourceType"],
    postedAt: row.posted_at ? String(row.posted_at) : null,
    lines: linesByEntry.get(String(row.id)) ?? [],
  }));
  const period = currentAccountingPeriod();
  const profitAndLoss = buildProfitAndLoss(accounts, entries, period.start, period.asOfDate);
  const storedAssumptions = scenarioResult.data?.assumptions;
  const projectionInput: CostProjectionInput = {
    ...defaultProjectionInput,
    ...(storedAssumptions && typeof storedAssumptions === "object" ? storedAssumptions : {}),
  };

  return {
    mode: "live",
    message: "Live accounting records from the Intentional HQ database.",
    business: {
      id: businessId,
      name: String(business.name),
      currency: String(business.currency),
      fiscalYearStartMonth: numberValue(business.fiscal_year_start_month),
    },
    period: { start: period.start, end: period.end, label: period.label },
    asOfDate: period.asOfDate,
    accounts,
    entries,
    profitAndLoss,
    balanceSheet: buildBalanceSheet(accounts, entries, period.asOfDate),
    trialBalance: buildTrialBalance(accounts, entries, period.asOfDate),
    projectionInput,
    actualOperatingCostCents: profitAndLoss.totalExpenseCents,
    unreconciledCount: sourceResult.count ?? 0,
    lastClosedThrough: periodsResult.data?.[0]?.end_date ? String(periodsResult.data[0].end_date) : null,
  };
}
