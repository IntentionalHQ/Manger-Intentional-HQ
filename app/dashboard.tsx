"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  Connection,
  ConnectionKind,
  ConnStatus,
  DashboardData,
} from "./hq-data";

type Section = "overview" | "data" | "social" | "sites" | "actions";

const navItems: { id: Section; label: string; mark: string }[] = [
  { id: "overview", label: "Overview", mark: "◐" },
  { id: "data", label: "Data", mark: "▤" },
  { id: "social", label: "Social", mark: "◈" },
  { id: "sites", label: "Sites", mark: "◇" },
  { id: "actions", label: "Actions", mark: "→" },
];

function StatusPill({ status }: { status: ConnStatus }) {
  if (status === "connected") {
    return <span className="pill pill-live"><span className="pill-dot" />Live</span>;
  }
  if (status === "error") {
    return <span className="pill pill-warn"><span className="pill-dot" />Needs attention</span>;
  }
  return <span className="pill pill-off"><span className="pill-dot" />Not connected</span>;
}

function formatSyncTime(value: string | null, verb = "Synced") {
  if (!value) return "Never synced";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Sync time unavailable";
  return `${verb} ${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDuration(value: number | null) {
  if (value === null) return "Duration unavailable";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} sec`;
}

function DeploymentPill({ status }: { status: string }) {
  const live = status === "ready";
  const failed = status === "error" || status === "canceled";
  return (
    <span
      className={`pill ${live ? "pill-live" : failed ? "pill-warn" : "pill-neutral"}`}
    >
      <span className="pill-dot" />
      {status.replaceAll("_", " ")}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts.at(-1)?.[0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function ConnectionGrid({
  connections,
}: {
  connections: Connection[];
}) {
  return (
    <div className="conn-grid">
      {connections.map((connection) => (
        <div className="conn" key={connection.id}>
          <span className="conn-icon">{connection.mark}</span>
          <div className="conn-body">
            <strong>{connection.name}</strong>
            <small>
              {connection.status === "connected"
                ? formatSyncTime(connection.lastSyncedAt)
                : connection.lastError ?? connection.detail}
            </small>
          </div>
          <StatusPill status={connection.status} />
        </div>
      ))}
    </div>
  );
}

export function Dashboard({
  initialData,
  user,
}: {
  initialData: DashboardData;
  user: { displayName: string; email: string; signOutPath: string };
}) {
  const [section, setSection] = useState<Section>("overview");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [activityFilter, setActivityFilter] = useState<
    "all" | "scurry" | "connections"
  >("all");

  const { connections, scurry, scurryBusiness, vercel } = initialData;
  const counts = useMemo(() => {
    const live = connections.filter(
      (connection) => connection.status === "connected",
    );
    return {
      total: connections.length,
      live: live.length,
      dataLive: live.filter((connection) => connection.kind === "data").length,
      socialLive: live.filter((connection) => connection.kind === "social").length,
      siteLive: live.filter((connection) => connection.kind === "site").length,
    };
  }, [connections]);

  const byKind = (kind: ConnectionKind) =>
    connections.filter((connection) => connection.kind === kind);

  const pageCopy: Record<Section, [string, string]> = {
    overview: ["Owner home base", "Users, product activity, and infrastructure in one view."],
    data: ["Scurry operations", "Account growth, usage, and database health."],
    social: ["Social accounts", "TikTok, YouTube, and Instagram in one place."],
    sites: ["Sites & infrastructure", "Production deployments, repositories, and domains."],
    actions: ["Quick actions", "Write back to connected systems."],
  };
  const [title, subhead] = pageCopy[section];
  const latestDeployment = vercel.deployments[0];
  const activeRate30 = scurryBusiness.totalUsers
    ? Math.round(
        (scurryBusiness.activeUsers30d / scurryBusiness.totalUsers) * 100,
      )
    : 0;

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        notes: form.get("notes"),
        dueDate: form.get("dueDate"),
        priority: form.get("priority"),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setSubmitting(false);

    if (!response.ok) {
      setFormMessage(payload.error ?? "The task could not be added.");
      return;
    }

    setFormMessage("Task added to Scurry.");
    event.currentTarget.reset();
    window.setTimeout(() => window.location.reload(), 650);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>HQ</span>
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? "page" : undefined}
            >
              <span className="nav-mark">{item.mark}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-button">
            <span className="avatar">{initials(user.displayName)}</span>
            <span>
              <strong>{user.displayName}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <a className="sign-out" href={user.signOutPath}>Sign out</a>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <header className="topbar">
            <div>
              <p className="eyebrow">
                {navItems.find((item) => item.id === section)?.label}
              </p>
              <h1>{title}</h1>
              <p className="subhead">{subhead}</p>
            </div>
            <div className="top-actions">
              <button
                className="btn btn-outline"
                onClick={() => setSection("actions")}
              >
                Quick action
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setSection("data")}
              >
                View sources
              </button>
            </div>
          </header>

          {section === "overview" && (
            <>
              <section className="stat-grid" aria-label="Connection summary">
                <article className="stat">
                  <div className="stat-label">Total Scurry users</div>
                  <div className="stat-value">
                    {formatCount(scurryBusiness.totalUsers)}
                  </div>
                  <div className="stat-sub">All registered accounts</div>
                </article>
                <article className="stat">
                  <div className="stat-label">New users</div>
                  <div className="stat-value">
                    {formatCount(scurryBusiness.newUsers7d)}
                  </div>
                  <div className="stat-sub">Registered in the last 7 days</div>
                </article>
                <article className="stat">
                  <div className="stat-label">Active users</div>
                  <div className="stat-value">
                    {formatCount(scurryBusiness.activeUsers30d)}
                  </div>
                  <div className="stat-sub">Signed in during the last 30 days</div>
                </article>
                <article className="stat">
                  <div className="stat-label">Latest deployment</div>
                  <div className="stat-value stat-state">
                    {latestDeployment?.status ?? "Not connected"}
                  </div>
                  <div className="stat-sub">
                    {latestDeployment
                      ? formatSyncTime(latestDeployment.createdAt, "Started")
                      : vercel.error ?? "Waiting for Vercel"}
                  </div>
                </article>
              </section>

              <section className="grid-2">
                <article className="card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">Audience</span>
                      <h2>Scurry account growth</h2>
                    </div>
                    <StatusPill status={scurryBusiness.status} />
                  </div>
                  {scurryBusiness.status === "error" ? (
                    <div className="empty">
                      <strong>Account analytics need attention.</strong>
                      {scurryBusiness.error}
                    </div>
                  ) : (
                    <div className="metric-list">
                      <div className="metric-row">
                        <span>New accounts, 7 days</span>
                        <strong>{formatCount(scurryBusiness.newUsers7d)}</strong>
                      </div>
                      <div className="metric-row">
                        <span>New accounts, 30 days</span>
                        <strong>{formatCount(scurryBusiness.newUsers30d)}</strong>
                      </div>
                      <div className="metric-row">
                        <span>Active users, 7 days</span>
                        <strong>{formatCount(scurryBusiness.activeUsers7d)}</strong>
                      </div>
                      <div className="metric-row">
                        <span>Active users, 30 days</span>
                        <strong>{formatCount(scurryBusiness.activeUsers30d)}</strong>
                      </div>
                    </div>
                  )}
                </article>

                <article className="card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">Product activity</span>
                      <h2>Tasks across Scurry</h2>
                    </div>
                    <span className="health-note">
                      {scurryBusiness.databaseLatencyMs} ms query
                    </span>
                  </div>
                  {scurryBusiness.status === "error" ? (
                    <div className="empty">Task analytics are unavailable.</div>
                  ) : (
                    <div className="metric-list">
                      <div className="metric-row">
                        <span>Total tasks</span>
                        <strong>{formatCount(scurryBusiness.totalTasks)}</strong>
                      </div>
                      <div className="metric-row">
                        <span>Open tasks</span>
                        <strong>{formatCount(scurryBusiness.openTasks)}</strong>
                      </div>
                      <div className="metric-row">
                        <span>Completed tasks</span>
                        <strong>{formatCount(scurryBusiness.completedTasks)}</strong>
                      </div>
                      <div className="metric-row">
                        <span>Created in 7 days</span>
                        <strong>{formatCount(scurryBusiness.tasksCreated7d)}</strong>
                      </div>
                    </div>
                  )}
                </article>
              </section>

              <section className="grid-2">
                <article className="card">
                  <div className="card-heading">
                    <div><span className="section-kicker">Today</span><h2>Scurry tasks</h2></div>
                    <StatusPill status={scurry.status} />
                  </div>
                  {scurry.status === "error" ? (
                    <div className="empty">
                      <strong>Scurry needs attention.</strong>
                      {scurry.error}
                    </div>
                  ) : scurry.tasks.length === 0 ? (
                    <div className="empty">
                      <strong>Nothing needs attention today.</strong>
                      Inbox, due, overdue, and flagged tasks will appear here.
                    </div>
                  ) : (
                    <div className="row-list">
                      {scurry.tasks.map((task) => (
                        <div className="row" key={task.id}>
                          <span className="row-icon">{task.flag ? "!" : "•"}</span>
                          <span>
                            <strong>{task.title}</strong>
                            <small>{task.section}{task.dueDate ? ` · ${task.dueDate}` : ""}</small>
                          </span>
                          <span className="pill pill-neutral">{task.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>

                <article className="card">
                  <div className="card-heading">
                    <div><span className="section-kicker">Recent activity</span><h2>Live events</h2></div>
                    <div className="filter-chips" aria-label="Filter activity">
                      {(["all", "scurry", "connections"] as const).map(
                        (filter) => (
                          <button
                            key={filter}
                            className={
                              activityFilter === filter
                                ? "filter-chip active"
                                : "filter-chip"
                            }
                            onClick={() => setActivityFilter(filter)}
                          >
                            {filter === "all"
                              ? "All"
                              : filter === "scurry"
                                ? "Scurry"
                                : "Systems"}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="row-list">
                    {activityFilter === "scurry" &&
                    scurry.tasks.length === 0 ? (
                      <div className="empty">No recent Scurry task events.</div>
                    ) : null}
                    {activityFilter !== "connections" &&
                      scurry.tasks.slice(0, 4).map((task) => (
                        <div className="row" key={`activity-${task.id}`}>
                          <span className="row-icon">S</span>
                          <span>
                            <strong>{task.title}</strong>
                            <small>{formatSyncTime(task.updatedAt, "Updated")}</small>
                          </span>
                          <span className="pill pill-neutral">Task</span>
                        </div>
                      ))}
                    {activityFilter !== "scurry" &&
                      connections
                        .filter((connection) => connection.lastSyncedAt)
                        .map((connection) => (
                          <div className="row" key={connection.id}>
                            <span className="row-icon">{connection.mark}</span>
                            <span>
                              <strong>{connection.name}</strong>
                              <small>{formatSyncTime(connection.lastSyncedAt)}</small>
                            </span>
                            <StatusPill status={connection.status} />
                          </div>
                        ))}
                  </div>
                </article>
              </section>
            </>
          )}

          {section === "data" && (
            <>
              <section className="grid-2">
                <article className="card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">Supabase</span>
                      <h2>Database health</h2>
                    </div>
                    <StatusPill status={scurryBusiness.status} />
                  </div>
                  <div className="metric-list">
                    <div className="metric-row">
                      <span>Owner query round trip</span>
                      <strong>{scurryBusiness.databaseLatencyMs} ms</strong>
                    </div>
                    <div className="metric-row">
                      <span>Last health check</span>
                      <strong>
                        {formatSyncTime(scurryBusiness.lastCheckedAt, "Checked")}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span>Records counted</span>
                      <strong>
                        {formatCount(
                          scurryBusiness.totalUsers +
                            scurryBusiness.totalTasks,
                        )}
                      </strong>
                    </div>
                  </div>
                </article>

                <article className="card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">Adoption</span>
                      <h2>Usage snapshot</h2>
                    </div>
                    <span className="health-note">{activeRate30}% active</span>
                  </div>
                  <div className="metric-list">
                    <div className="metric-row">
                      <span>30-day active users</span>
                      <strong>
                        {formatCount(scurryBusiness.activeUsers30d)}
                        {" / "}
                        {formatCount(scurryBusiness.totalUsers)}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span>Tasks created, 30 days</span>
                      <strong>
                        {formatCount(scurryBusiness.tasksCreated30d)}
                      </strong>
                    </div>
                    <div className="metric-row">
                      <span>Completed tasks</span>
                      <strong>
                        {formatCount(scurryBusiness.completedTasks)}
                      </strong>
                    </div>
                  </div>
                </article>
              </section>

              <section className="card">
                <div className="card-heading">
                  <div>
                    <span className="section-kicker">Databases</span>
                    <h2>Data sources</h2>
                  </div>
                </div>
                <ConnectionGrid connections={byKind("data")} />
              </section>
            </>
          )}

          {section === "social" && (
            <section className="card">
              <div className="card-heading">
                <div><span className="section-kicker">Channels</span><h2>Social accounts</h2></div>
              </div>
              <ConnectionGrid connections={byKind("social")} />
            </section>
          )}

          {section === "sites" && (
            <>
              <section className="grid-2">
                <article className="card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">Production</span>
                      <h2>Latest Vercel deployment</h2>
                    </div>
                    {latestDeployment ? (
                      <DeploymentPill status={latestDeployment.status} />
                    ) : (
                      <StatusPill status={vercel.status} />
                    )}
                  </div>
                  {latestDeployment ? (
                    <div className="deployment-detail">
                      <strong>{latestDeployment.commitMessage}</strong>
                      <p>
                        {latestDeployment.branch}
                        {latestDeployment.commitSha
                          ? ` at ${latestDeployment.commitSha.slice(0, 7)}`
                          : ""}
                      </p>
                      <div className="deployment-meta">
                        <span>
                          {formatSyncTime(
                            latestDeployment.createdAt,
                            "Started",
                          )}
                        </span>
                        <span>
                          {formatDuration(latestDeployment.durationMs)}
                        </span>
                      </div>
                      {latestDeployment.url ? (
                        <a
                          className="text-link"
                          href={latestDeployment.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open deployment
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div className="empty">
                      <strong>Vercel monitoring needs attention.</strong>
                      {vercel.error ?? "No deployments were returned."}
                    </div>
                  )}
                </article>

                <article className="card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">Recent runs</span>
                      <h2>Deployment reliability</h2>
                    </div>
                    <span className="health-note">
                      {vercel.deployments.length} checked
                    </span>
                  </div>
                  <div className="metric-list">
                    <div className="metric-row">
                      <span>Ready</span>
                      <strong>{vercel.successfulCount}</strong>
                    </div>
                    <div className="metric-row">
                      <span>Failed or canceled</span>
                      <strong>{vercel.failedCount}</strong>
                    </div>
                    <div className="metric-row">
                      <span>Last checked</span>
                      <strong>
                        {formatSyncTime(vercel.lastCheckedAt, "Checked")}
                      </strong>
                    </div>
                  </div>
                </article>
              </section>

              {vercel.deployments.length > 0 ? (
                <section className="card deployment-history">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">History</span>
                      <h2>Recent Vercel deployments</h2>
                    </div>
                  </div>
                  <div className="row-list">
                    {vercel.deployments.slice(0, 6).map((deployment) => (
                      <div className="row" key={deployment.id}>
                        <span className="row-icon">V</span>
                        <span>
                          <strong>{deployment.commitMessage}</strong>
                          <small>
                            {deployment.branch}
                            {" · "}
                            {formatSyncTime(deployment.createdAt, "Started")}
                          </small>
                        </span>
                        <DeploymentPill status={deployment.status} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="card">
                <div className="card-heading">
                  <div>
                    <span className="section-kicker">Infrastructure</span>
                    <h2>Sites and services</h2>
                  </div>
                </div>
                <ConnectionGrid connections={byKind("site")} />
              </section>
            </>
          )}

          {section === "actions" && (
            <section className="grid-2">
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Scurry</span><h2>Add a task</h2></div>
                  <StatusPill status={scurry.status} />
                </div>
                {scurry.status === "connected" ? (
                  <form className="task-form" onSubmit={submitTask}>
                    <label>
                      Task title
                      <input name="title" required maxLength={500} placeholder="What needs doing?" />
                    </label>
                    <label>
                      Notes
                      <textarea name="notes" placeholder="Optional context" />
                    </label>
                    <div className="form-grid">
                      <label>
                        Due date
                        <input name="dueDate" type="date" />
                      </label>
                      <label>
                        Priority
                        <select name="priority" defaultValue="medium">
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </label>
                    </div>
                    <div className="form-actions">
                      <span role="status">{formMessage}</span>
                      <button className="btn btn-primary" disabled={submitting}>
                        {submitting ? "Adding…" : "Add to Scurry"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="empty">
                    Resolve the Scurry connection before writing tasks.
                  </div>
                )}
              </article>
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Publish</span><h2>Compose a post</h2></div>
                  <StatusPill status="not_connected" />
                </div>
                <div className="empty">
                  <strong>Connect TikTok first.</strong>
                  Publishing controls will appear after TikTok OAuth and Content
                  Posting API access are configured.
                </div>
              </article>
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Ops</span><h2>Run a query</h2></div>
                </div>
                <div className="empty">Query controls will use a separately scoped database connection.</div>
              </article>
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Deploy</span><h2>Trigger a build</h2></div>
                </div>
                <div className="empty">Deploy controls arrive once Vercel or Cloudflare is connected.</div>
              </article>
            </section>
          )}

          <footer className="footer">
            <span>Intentional HQ · authenticated</span>
            <span>{counts.live} of {counts.total} sources live</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
