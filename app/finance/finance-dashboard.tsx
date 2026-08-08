"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { buildScaleScenarios, projectCosts } from "./projection";
import type { AccountBalance, CostProjectionInput, FinanceWorkspace, LedgerAccount } from "./types";

type FinanceSection = "accounting" | "planning" | "reports";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const preciseMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(cents: number, precise = false) {
  return (precise ? preciseMoney : money).format(cents / 100);
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : name.slice(0, 2)).toUpperCase();
}

function previousMonthPeriod(currentStart = new Date().toISOString().slice(0, 10)) {
  const date = new Date(`${currentStart}T00:00:00Z`);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function ModePill({ mode }: { mode: FinanceWorkspace["mode"] }) {
  if (mode === "live") return <span className="pill pill-live"><span className="pill-dot" />Live books</span>;
  if (mode === "preview") return <span className="pill pill-warn"><span className="pill-dot" />Preview data</span>;
  return <span className="pill pill-off"><span className="pill-dot" />Setup required</span>;
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" | "bad" }) {
  return (
    <div className="stat finance-stat">
      <span className="stat-label">{label}</span>
      <div className={`stat-value ${tone ? `finance-${tone}` : ""}`}>{value}</div>
      <div className="stat-sub">{note}</div>
    </div>
  );
}

function MoneyRows({ rows, empty = "No activity in this period." }: { rows: AccountBalance[]; empty?: string }) {
  if (!rows.length) return <div className="empty compact-empty">{empty}</div>;
  return (
    <div className="finance-money-list">
      {rows.map((row) => (
        <div className="finance-money-row" key={row.id}>
          <span><small>{row.code}</small>{row.name}</span>
          <strong>{formatMoney(row.balanceCents)}</strong>
        </div>
      ))}
    </div>
  );
}

export function FinanceDashboard({
  initialWorkspace,
  user,
}: {
  initialWorkspace: FinanceWorkspace;
  user: { displayName: string; email: string; signOutPath: string };
}) {
  const [section, setSection] = useState<FinanceSection>("accounting");
  const [entryOpen, setEntryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectionInput, setProjectionInput] = useState<CostProjectionInput>(initialWorkspace.projectionInput);
  const projection = useMemo(() => projectCosts(projectionInput), [projectionInput]);
  const scaleScenarios = useMemo(() => buildScaleScenarios(projectionInput), [projectionInput]);
  const { profitAndLoss: pnl } = initialWorkspace;

  const copy = {
    accounting: ["Accounting", "Clean books, current performance, and month-end controls."],
    planning: ["Cost planning", "Model unit economics and infrastructure costs as Scurry grows."],
    reports: ["Reports", "Accountant-ready statements and the detail behind every number."],
  } satisfies Record<FinanceSection, [string, string]>;

  async function initializeBooks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/finance/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(payload.error ?? "The books could not be created.");
    window.location.reload();
  }

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (initialWorkspace.mode !== "live") {
      setMessage("Connect the Intentional HQ database before saving accounting records.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const kind = String(form.get("kind"));
    const amountCents = Math.round(Number(form.get("amount")) * 100);
    const categoryId = String(form.get("category"));
    const cash = initialWorkspace.accounts.find((account) => account.subtype === "cash");
    if (!cash || !categoryId || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      setMessage("Choose an account and enter a positive amount.");
      return;
    }
    const lines = kind === "expense"
      ? [
          { accountId: categoryId, debitCents: amountCents, creditCents: 0 },
          { accountId: cash.id, debitCents: 0, creditCents: amountCents },
        ]
      : [
          { accountId: cash.id, debitCents: amountCents, creditCents: 0 },
          { accountId: categoryId, debitCents: 0, creditCents: amountCents },
        ];
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/finance/journal-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryDate: form.get("date"),
        memo: form.get("memo"),
        lines,
      }),
    });
    const payload = (await response.json()) as { error?: string; entryId?: string };
    setBusy(false);
    if (!response.ok) return setMessage(payload.error ?? "The transaction could not be posted.");
    const receipt = form.get("receipt");
    if (receipt instanceof File && receipt.size && payload.entryId) {
      const receiptForm = new FormData();
      receiptForm.set("entryId", payload.entryId);
      receiptForm.set("file", receipt);
      const receiptResponse = await fetch("/api/finance/receipts", { method: "POST", body: receiptForm });
      if (!receiptResponse.ok) {
        const receiptPayload = (await receiptResponse.json()) as { error?: string };
        window.alert(`The transaction was posted, but its receipt was not attached. ${receiptPayload.error ?? "Try attaching it again later."}`);
      }
    }
    window.location.reload();
  }

  async function saveScenario() {
    if (initialWorkspace.mode !== "live") {
      setMessage("Connect the Intentional HQ database before saving scenarios.");
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/finance/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assumptions: projectionInput }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    setMessage(response.ok ? "Base scenario saved." : payload.error ?? "Scenario could not be saved.");
  }

  async function reverseEntry(entryId: string) {
    if (initialWorkspace.mode !== "live") return;
    const reason = window.prompt("Reason for reversing this posted entry?");
    if (!reason?.trim()) return;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/finance/journal-entries/${entryId}/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim(), date: new Date().toISOString().slice(0, 10) }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(payload.error ?? "The entry could not be reversed.");
    window.location.reload();
  }

  async function closePreviousMonth() {
    if (initialWorkspace.mode !== "live") return;
    const period = previousMonthPeriod(initialWorkspace.period.start);
    if (!window.confirm(`Lock accounting records from ${period.start} through ${period.end}? This cannot be undone in the app.`)) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/finance/periods/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(period),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setMessage(payload.error ?? "The period could not be closed.");
    window.location.reload();
  }

  function downloadCsv(name: string, rows: Array<Array<string | number>>) {
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand finance-brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span>HQ</span>
        </Link>
        <nav className="primary-nav" aria-label="Finance navigation">
          <p className="nav-label">Workspace</p>
          <Link className="nav-item" href="/"><span className="nav-mark">H</span><span>HQ overview</span></Link>
          <p className="nav-label">Finance</p>
          {([
            ["accounting", "Accounting", "$"],
            ["planning", "Planning", "P"],
            ["reports", "Reports", "R"],
          ] as const).map(([id, label, mark]) => (
            <button key={id} className={section === id ? "nav-item active" : "nav-item"} onClick={() => setSection(id)}>
              <span className="nav-mark">{mark}</span><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="profile-button">
            <span className="avatar">{initials(user.displayName)}</span>
            <span><strong>{user.displayName}</strong><small>{user.email}</small></span>
          </div>
          <a className="sign-out" href={user.signOutPath}>Sign out</a>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner finance-main">
          <header className="topbar">
            <div>
              <p className="eyebrow">{initialWorkspace.business.name}</p>
              <h1>{copy[section][0]}</h1>
              <p className="subhead">{copy[section][1]}</p>
            </div>
            <div className="top-actions">
              <ModePill mode={initialWorkspace.mode} />
              {section === "accounting" && initialWorkspace.mode !== "setup_required" ? (
                <button className="btn btn-primary" onClick={() => setEntryOpen(true)}>Add transaction</button>
              ) : null}
            </div>
          </header>

          {initialWorkspace.mode !== "live" ? (
            <section className="finance-banner" role="status">
              <span className="finance-banner-mark">!</span>
              <div><strong>{initialWorkspace.mode === "preview" ? "Finance preview" : "Finish finance setup"}</strong><p>{initialWorkspace.message}</p></div>
            </section>
          ) : null}
          {message ? <div className="finance-message" role="status">{message}</div> : null}

          {section === "accounting" && (
            <AccountingView workspace={initialWorkspace} onInitialize={initializeBooks} onReverse={reverseEntry} busy={busy} />
          )}
          {section === "planning" && (
            <PlanningView
              input={projectionInput}
              setInput={setProjectionInput}
              projection={projection}
              scenarios={scaleScenarios}
              actualCostCents={initialWorkspace.actualOperatingCostCents}
              onSave={saveScenario}
              busy={busy}
            />
          )}
          {section === "reports" && (
            <ReportsView
              workspace={initialWorkspace}
              onDownloadPnl={() => downloadCsv(
                `profit-and-loss-${initialWorkspace.period.start}.csv`,
                [
                  ["Account", "Type", "Amount"],
                  ...pnl.revenue.map((row) => [`${row.code} ${row.name}`, "Revenue", row.balanceCents / 100]),
                  ...pnl.expenses.map((row) => [`${row.code} ${row.name}`, "Expense", row.balanceCents / 100]),
                  ["Net income", "Total", pnl.netIncomeCents / 100],
                ],
              )}
              onDownloadTrial={() => downloadCsv(
                `trial-balance-${initialWorkspace.period.end}.csv`,
                [
                  ["Code", "Account", "Type", "Debits", "Credits", "Balance"],
                  ...initialWorkspace.trialBalance.map((row) => [row.code, row.name, row.type, row.debitCents / 100, row.creditCents / 100, row.balanceCents / 100]),
                ],
              )}
              onDownloadLedger={() => downloadCsv(
                `general-ledger-${initialWorkspace.period.start}.csv`,
                [
                  ["Entry", "Date", "Memo", "Status", "Source", "Account code", "Account", "Debit", "Credit"],
                  ...initialWorkspace.entries.flatMap((entry) => entry.lines.map((line) => {
                    const account = initialWorkspace.accounts.find((candidate) => candidate.id === line.accountId);
                    return [
                      `JE-${String(entry.entryNumber).padStart(4, "0")}`,
                      entry.entryDate,
                      entry.memo,
                      entry.status,
                      entry.sourceType,
                      account?.code ?? "",
                      account?.name ?? "Unknown account",
                      line.debitCents / 100,
                      line.creditCents / 100,
                    ];
                  })),
                ],
              )}
              onClosePrevious={closePreviousMonth}
              busy={busy}
            />
          )}

          <footer className="footer"><span>Intentional HQ · Finance</span><span>{initialWorkspace.period.label}</span></footer>
        </div>
      </main>

      {entryOpen ? (
        <TransactionSheet
          accounts={initialWorkspace.accounts}
          mode={initialWorkspace.mode}
          busy={busy}
          onClose={() => setEntryOpen(false)}
          onSubmit={addTransaction}
        />
      ) : null}
    </div>
  );
}

function AccountingView({ workspace, onInitialize, onReverse, busy }: { workspace: FinanceWorkspace; onInitialize: (event: FormEvent<HTMLFormElement>) => void; onReverse: (entryId: string) => void; busy: boolean }) {
  const pnl = workspace.profitAndLoss;
  const balance = workspace.balanceSheet;
  const operatingCashCents = workspace.trialBalance.find((account) => account.subtype === "cash")?.balanceCents ?? 0;
  if (workspace.mode === "setup_required" && !workspace.business.id) {
    return (
      <section className="finance-onboarding card">
        <span className="section-kicker">One-time setup</span>
        <h2>Create clean company books</h2>
        <p>We will create a startup chart of accounts, an audit trail, and a default cost scenario. Nothing is written to Scurry.</p>
        <form className="task-form" onSubmit={onInitialize}>
          <label>Company name<input name="name" required minLength={2} maxLength={120} placeholder="Intentional Labs LLC" /></label>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create finance workspace"}</button>
        </form>
      </section>
    );
  }
  return (
    <>
      <section className="stat-grid">
        <Metric label="Operating cash" value={formatMoney(operatingCashCents)} note={`As of ${formatDate(workspace.asOfDate)}`} />
        <Metric label="Revenue" value={formatMoney(pnl.totalRevenueCents)} note={`${workspace.period.label} MTD`} />
        <Metric label="Operating expenses" value={formatMoney(pnl.totalExpenseCents)} note={`${workspace.period.label} MTD`} />
        <Metric label="Net income" value={formatMoney(pnl.netIncomeCents)} note="Revenue less expenses" tone={pnl.netIncomeCents >= 0 ? "good" : "bad"} />
      </section>

      <section className="finance-attention-grid">
        <article className="finance-attention card">
          <span className="finance-attention-number">{workspace.unreconciledCount}</span>
          <div><strong>Transactions need review</strong><small>Categorize or match imported activity before closing.</small></div>
        </article>
        <article className="finance-attention card">
          <span className={`finance-check ${balance.differenceCents === 0 ? "ok" : "warn"}`}>{balance.differenceCents === 0 ? "OK" : "!"}</span>
          <div><strong>Books {balance.differenceCents === 0 ? "balance" : "need attention"}</strong><small>Assets minus liabilities and equity: {formatMoney(balance.differenceCents)}.</small></div>
        </article>
        <article className="finance-attention card">
          <span className="finance-check">M</span>
          <div><strong>Month is open</strong><small>{workspace.lastClosedThrough ? `Closed through ${formatDate(workspace.lastClosedThrough)}` : "No accounting period has been locked yet."}</small></div>
        </article>
      </section>

      <section className="grid-2 finance-statement-grid">
        <article className="card">
          <div className="card-heading"><div><span className="section-kicker">Performance</span><h2>Profit and loss</h2></div><span className="health-note">{workspace.period.label}</span></div>
          <MoneyRows rows={pnl.revenue} />
          <div className="finance-subtotal"><span>Total revenue</span><strong>{formatMoney(pnl.totalRevenueCents)}</strong></div>
          <MoneyRows rows={pnl.expenses} />
          <div className="finance-total"><span>Net income</span><strong>{formatMoney(pnl.netIncomeCents)}</strong></div>
        </article>
        <article className="card">
          <div className="card-heading"><div><span className="section-kicker">Position</span><h2>Balance sheet</h2></div><span className="health-note">As of {formatDate(workspace.asOfDate)}</span></div>
          <MoneyRows rows={balance.assets} />
          <div className="finance-subtotal"><span>Total assets</span><strong>{formatMoney(balance.totalAssetsCents)}</strong></div>
          <MoneyRows rows={balance.liabilities} empty="No liabilities recorded." />
          <div className="finance-money-row"><span>Founder equity</span><strong>{formatMoney(balance.statedEquityCents)}</strong></div>
          <div className="finance-money-row"><span>Current earnings</span><strong>{formatMoney(balance.currentEarningsCents)}</strong></div>
          <div className="finance-total"><span>Liabilities + equity</span><strong>{formatMoney(balance.totalLiabilitiesCents + balance.totalEquityCents)}</strong></div>
        </article>
      </section>

      <section className="card">
        <div className="card-heading"><div><span className="section-kicker">Audit trail</span><h2>Recent journal entries</h2></div><span className="health-note">Posted entries cannot be edited</span></div>
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead><tr><th>No.</th><th>Date</th><th>Memo</th><th>Source</th><th className="number">Amount</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {workspace.entries.slice(0, 10).map((entry) => (
                <tr key={entry.id}>
                  <td>JE-{String(entry.entryNumber).padStart(4, "0")}</td><td>{formatDate(entry.entryDate)}</td><td>{entry.memo}</td>
                  <td>{entry.sourceType.replaceAll("_", " ")}</td><td className="number">{formatMoney(entry.lines.reduce((sum, line) => sum + line.debitCents, 0))}</td>
                  <td><span className="pill pill-live">{entry.status}</span></td>
                  <td>{entry.status === "posted" && workspace.mode === "live" ? <button className="btn btn-ghost finance-table-action" disabled={busy} onClick={() => onReverse(entry.id)}>Reverse</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PlanningView({ input, setInput, projection, scenarios, actualCostCents, onSave, busy }: {
  input: CostProjectionInput;
  setInput: (input: CostProjectionInput) => void;
  projection: ReturnType<typeof projectCosts>;
  scenarios: ReturnType<typeof buildScaleScenarios>;
  actualCostCents: number;
  onSave: () => void;
  busy: boolean;
}) {
  const updateNumber = (key: keyof CostProjectionInput, value: string, multiplier = 1) => {
    const parsed = Math.max(0, Number(value) * multiplier);
    if (Number.isFinite(parsed)) setInput({ ...input, [key]: parsed });
  };
  const variance = actualCostCents - projection.totalMonthlyCostCents;
  return (
    <>
      <section className="card finance-scenario-card">
        <div className="card-heading"><div><span className="section-kicker">Base scenario</span><h2>Quick growth assumptions</h2></div><button className="btn btn-outline" onClick={onSave} disabled={busy}>{busy ? "Saving…" : "Save scenario"}</button></div>
        <div className="finance-input-grid">
          <label>Paying users<input type="number" min="0" step="100" value={input.payingUsers} onChange={(event) => updateNumber("payingUsers", event.target.value)} /></label>
          <label>Monthly price<input type="number" min="0" step="0.01" value={(input.monthlyPriceCents / 100).toFixed(2)} onChange={(event) => updateNumber("monthlyPriceCents", event.target.value, 100)} /></label>
          <label>Free users per paying user<input type="number" min="0" step="0.1" value={input.freeUsersPerPayingUser} onChange={(event) => updateNumber("freeUsersPerPayingUser", event.target.value)} /></label>
          <label>Bank-sync adoption<input type="number" min="0" max="100" step="1" value={(input.bankSyncAdoption * 100).toFixed(0)} onChange={(event) => updateNumber("bankSyncAdoption", event.target.value, 0.01)} /></label>
          <label className="finance-toggle"><input type="checkbox" checked={input.includeOptionalBudgets} onChange={(event) => setInput({ ...input, includeOptionalBudgets: event.target.checked })} />Include staff and optional budgets</label>
        </div>
      </section>

      <section className="stat-grid">
        <Metric label="Monthly revenue" value={formatMoney(projection.monthlyRevenueCents)} note={`${projection.activeUsers.toLocaleString()} active users`} />
        <Metric label="Monthly cost" value={formatMoney(projection.totalMonthlyCostCents)} note={`${formatMoney(projection.costPerPayingUserCents, true)} per paying user`} />
        <Metric label="Net cash" value={formatMoney(projection.netCashCents)} note={`${(projection.netMargin * 100).toFixed(1)}% projected margin`} tone={projection.netCashCents >= 0 ? "good" : "bad"} />
        <Metric label="Break-even" value={projection.breakEvenPayingUsers.toLocaleString()} note="Approximate paying users" />
      </section>

      <section className="grid-2">
        <article className="card">
          <div className="card-heading"><div><span className="section-kicker">Unit economics</span><h2>Monthly cost breakdown</h2></div></div>
          <div className="finance-bars">
            {projection.costLines.map((line) => {
              const width = projection.totalMonthlyCostCents ? (line.cents / projection.totalMonthlyCostCents) * 100 : 0;
              return <div className="finance-bar-row" key={line.key}><div><span>{line.label}</span><strong>{formatMoney(line.cents)}</strong></div><div className="finance-bar-track"><span style={{ width: `${Math.max(width, line.cents ? 1 : 0)}%` }} /></div><small>{line.behavior}</small></div>;
            })}
          </div>
        </article>
        <article className="card">
          <div className="card-heading"><div><span className="section-kicker">Feedback loop</span><h2>Actual vs forecast</h2></div><span className={`pill ${variance <= 0 ? "pill-live" : "pill-warn"}`}>{variance <= 0 ? "Under plan" : "Over plan"}</span></div>
          <div className="finance-compare">
            <div><span>Forecast operating cost</span><strong>{formatMoney(projection.totalMonthlyCostCents)}</strong></div>
            <div><span>Accounting actual</span><strong>{formatMoney(actualCostCents)}</strong></div>
            <div className="finance-total"><span>Variance</span><strong>{formatMoney(Math.abs(variance))} {variance <= 0 ? "favorable" : "unfavorable"}</strong></div>
          </div>
          <p className="finance-note">When live, posted expense accounts calibrate the model without changing the accounting ledger.</p>
        </article>
      </section>

      <section className="card">
        <div className="card-heading"><div><span className="section-kicker">Infrastructure</span><h2>Included capacity</h2></div><span className="health-note">Planning estimates</span></div>
        <div className="finance-capacity-grid">
          {projection.capacity.map((item) => (
            <div className="finance-capacity" key={item.label}>
              <div><span>{item.label}</span><strong>{item.used.toLocaleString(undefined, { maximumFractionDigits: 1 })} / {item.included.toLocaleString()} {item.unit}</strong></div>
              <div className="finance-capacity-track"><span className={item.utilization > 1 ? "over" : item.utilization > 0.8 ? "watch" : ""} style={{ width: `${Math.min(item.utilization * 100, 100)}%` }} /></div>
              <small>{(item.utilization * 100).toFixed(1)}% used</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-heading"><div><span className="section-kicker">Scale simulator</span><h2>Economics at different customer counts</h2></div></div>
        <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Paying users</th><th className="number">Revenue</th><th className="number">Cost</th><th className="number">Net cash</th><th className="number">Margin</th><th className="number">Cost / user</th></tr></thead><tbody>
          {scenarios.map((scenario) => <tr key={scenario.input.payingUsers} className={scenario.input.payingUsers === projection.input.payingUsers ? "selected" : ""}><td>{scenario.input.payingUsers.toLocaleString()}</td><td className="number">{formatMoney(scenario.monthlyRevenueCents)}</td><td className="number">{formatMoney(scenario.totalMonthlyCostCents)}</td><td className="number">{formatMoney(scenario.netCashCents)}</td><td className="number">{(scenario.netMargin * 100).toFixed(1)}%</td><td className="number">{formatMoney(scenario.costPerPayingUserCents, true)}</td></tr>)}
        </tbody></table></div>
      </section>
    </>
  );
}

function ReportsView({ workspace, onDownloadPnl, onDownloadTrial, onDownloadLedger, onClosePrevious, busy }: { workspace: FinanceWorkspace; onDownloadPnl: () => void; onDownloadTrial: () => void; onDownloadLedger: () => void; onClosePrevious: () => void; busy: boolean }) {
  const previousPeriod = previousMonthPeriod(workspace.period.start);
  const previousIsClosed = Boolean(workspace.lastClosedThrough && workspace.lastClosedThrough >= previousPeriod.end);
  return (
    <>
      <section className="grid-2">
        <article className="card finance-report-card"><span className="section-kicker">Monthly statement</span><h2>Profit and loss</h2><p>Revenue, operating expenses, and net income for {workspace.period.label}.</p><button className="btn btn-outline" onClick={onDownloadPnl}>Download CSV</button></article>
        <article className="card finance-report-card"><span className="section-kicker">Audit report</span><h2>Trial balance</h2><p>Every account’s debit, credit, and normal balance through {formatDate(workspace.asOfDate)}.</p><button className="btn btn-outline" onClick={onDownloadTrial}>Download CSV</button></article>
        <article className="card finance-report-card"><span className="section-kicker">Book detail</span><h2>General ledger</h2><p>Every debit and credit with its journal number, source, and status.</p><button className="btn btn-outline" onClick={onDownloadLedger}>Download CSV</button></article>
      </section>
      <section className="card">
        <div className="card-heading"><div><span className="section-kicker">General ledger control</span><h2>Trial balance</h2></div><span className={`pill ${workspace.balanceSheet.differenceCents === 0 ? "pill-live" : "pill-warn"}`}>{workspace.balanceSheet.differenceCents === 0 ? "Balanced" : "Review"}</span></div>
        <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="number">Debits</th><th className="number">Credits</th><th className="number">Balance</th></tr></thead><tbody>
          {workspace.trialBalance.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{row.type}</td><td className="number">{formatMoney(row.debitCents)}</td><td className="number">{formatMoney(row.creditCents)}</td><td className="number"><strong>{formatMoney(row.balanceCents)}</strong></td></tr>)}
        </tbody></table></div>
      </section>
      <section className="card">
        <div className="card-heading"><div><span className="section-kicker">Close controls</span><h2>Month-end checklist</h2></div>{workspace.mode === "live" ? <button className="btn btn-outline" disabled={busy || previousIsClosed} onClick={onClosePrevious}>{previousIsClosed ? "Previous month locked" : busy ? "Locking…" : "Lock previous month"}</button> : null}</div>
        <div className="finance-checklist">
          {[workspace.unreconciledCount === 0, true, workspace.balanceSheet.differenceCents === 0, false].map((done, index) => (
            <div key={index}><span className={done ? "done" : ""}>{done ? "✓" : index + 1}</span><div><strong>{["Review imported transactions", "Confirm receipts and supporting documents", "Verify the trial balance", "Lock the accounting period"][index]}</strong><small>{[`${workspace.unreconciledCount} transactions remain`, "Attach source documents to material expenses", "Assets must equal liabilities plus equity", "Locking prevents accidental backdated changes"][index]}</small></div></div>
          ))}
        </div>
      </section>
    </>
  );
}

function TransactionSheet({ accounts, mode, busy, onClose, onSubmit }: { accounts: LedgerAccount[]; mode: FinanceWorkspace["mode"]; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [kind, setKind] = useState("expense");
  const allowed = kind === "expense" ? accounts.filter((account) => account.type === "expense") : kind === "income" ? accounts.filter((account) => account.type === "revenue") : accounts.filter((account) => account.type === "equity");
  return (
    <div className="finance-sheet-backdrop" onMouseDown={onClose}>
      <aside className="finance-sheet" role="dialog" aria-modal="true" aria-labelledby="transaction-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="card-heading"><div><span className="section-kicker">Balanced journal</span><h2 id="transaction-title">Add transaction</h2></div><button className="btn btn-ghost" onClick={onClose} aria-label="Close">Close</button></div>
        <p className="finance-note">Each transaction creates equal debits and credits. Once posted, corrections use a reversal instead of editing history.</p>
        <form className="task-form" onSubmit={onSubmit}>
          <label>Transaction type<select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}><option value="expense">Expense paid from cash</option><option value="income">Income received in cash</option><option value="contribution">Founder contribution</option></select></label>
          <label>{kind === "expense" ? "Expense account" : kind === "income" ? "Revenue account" : "Equity account"}<select name="category" required defaultValue=""><option value="" disabled>Choose account</option>{allowed.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
          <div className="form-grid"><label>Date<input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Amount<input type="number" name="amount" required min="0.01" step="0.01" placeholder="0.00" /></label></div>
          <label>Memo<input name="memo" required maxLength={500} placeholder="What was this transaction for?" /></label>
          <label>Receipt <small>(optional)</small><input type="file" name="receipt" accept="application/pdf,image/jpeg,image/png,image/webp" /></label>
          {mode !== "live" ? <div className="finance-message">Preview only — connect the HQ database to post this entry.</div> : null}
          <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || mode !== "live"}>{busy ? "Posting…" : "Post transaction"}</button></div>
        </form>
      </aside>
    </div>
  );
}
