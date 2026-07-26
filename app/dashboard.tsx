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
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [postMessage, setPostMessage] = useState("");
  const [activityFilter, setActivityFilter] = useState<
    "all" | "scurry" | "connections"
  >("all");

  const { connections, scurry, bluesky } = initialData;
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
    overview: ["Home base", "Real status from the systems you run."],
    data: ["Data sources", "Scurry and HQ records in one place."],
    social: ["Social accounts", "Every channel in one place."],
    sites: ["Sites & infra", "Deployments, repos, and domains."],
    actions: ["Quick actions", "Write back to connected systems."],
  };
  const [title, subhead] = pageCopy[section];

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

  async function submitBlueskyPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPostSubmitting(true);
    setPostMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/social/bluesky/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: form.get("text") }),
    });
    const payload = (await response.json()) as { error?: string };
    setPostSubmitting(false);

    if (!response.ok) {
      setPostMessage(payload.error ?? "The post could not be published.");
      return;
    }

    setPostMessage("Published to Bluesky.");
    event.currentTarget.reset();
    window.setTimeout(() => window.location.reload(), 650);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">H</span>
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
                  <div className="stat-label">Connections live</div>
                  <div className="stat-value">{counts.live}<span> / {counts.total}</span></div>
                  <div className="stat-sub">Verified from HQ records</div>
                </article>
                <article className="stat">
                  <div className="stat-label">Scurry today</div>
                  <div className="stat-value">{scurry.todayCount}</div>
                  <div className="stat-sub">Inbox, due, overdue, or flagged</div>
                </article>
                <article className="stat">
                  <div className="stat-label">Overdue</div>
                  <div className="stat-value">{scurry.overdueCount}</div>
                  <div className="stat-sub">Incomplete tasks before today</div>
                </article>
                <article className="stat">
                  <div className="stat-label">Open in Scurry</div>
                  <div className="stat-value">{scurry.openCount}</div>
                  <div className="stat-sub">{formatSyncTime(scurry.lastSyncedAt)}</div>
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
            <section className="card">
              <div className="card-heading">
                <div><span className="section-kicker">Databases</span><h2>Data sources</h2></div>
              </div>
              <ConnectionGrid connections={byKind("data")} />
            </section>
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
            <section className="card">
              <div className="card-heading">
                <div><span className="section-kicker">Infrastructure</span><h2>Sites & deployments</h2></div>
              </div>
              <ConnectionGrid connections={byKind("site")} />
            </section>
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
                  <StatusPill status={bluesky.status} />
                </div>
                {bluesky.status === "connected" ? (
                  <form className="task-form" onSubmit={submitBlueskyPost}>
                    <label>
                      Bluesky post
                      <textarea
                        name="text"
                        required
                        maxLength={300}
                        placeholder="What do you want to share?"
                      />
                    </label>
                    <div className="form-actions">
                      <span role="status">{postMessage}</span>
                      <button
                        className="btn btn-primary"
                        disabled={postSubmitting}
                      >
                        {postSubmitting ? "Publishing…" : "Publish to Bluesky"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="empty">
                    <strong>
                      {bluesky.status === "error"
                        ? "Bluesky needs attention."
                        : "Bluesky is ready for credentials."}
                    </strong>
                    {bluesky.error ??
                      "Add a handle and app password to enable authenticated publishing."}
                  </div>
                )}
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
