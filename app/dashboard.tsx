"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
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

function mediaHost(value: string) {
  if (!value) return "No media URL yet";
  try {
    return new URL(value).hostname;
  } catch {
    return "Complete the media URL";
  }
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
          {connection.actionHref ? (
            <a className="conn-action" href={connection.actionHref}>
              {connection.actionLabel ?? "Connect"}
            </a>
          ) : (
            <StatusPill status={connection.status} />
          )}
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
  const [publishSubmitting, setPublishSubmitting] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [querySubmitting, setQuerySubmitting] = useState(false);
  const [queryMessage, setQueryMessage] = useState("");
  const [queryResult, setQueryResult] = useState("");
  const [queryDraft, setQueryDraft] = useState("");
  const [composePreview, setComposePreview] = useState<{
    caption: string;
    title: string;
    mediaUrl: string;
    targets: string[];
  }>({ caption: "", title: "", mediaUrl: "", targets: [] });
  const [deploySubmitting, setDeploySubmitting] = useState(false);
  const [deployMessage, setDeployMessage] = useState("");
  const [activityFilter, setActivityFilter] = useState<
    "all" | "scurry" | "connections"
  >("all");

  const {
    connections,
    scurry,
    scurryBusiness,
    social,
    vercel,
    github,
    cloudflare,
    activity,
    savedQueries,
  } = initialData;
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
  const connectedSocial = social.filter(
    (summary) => summary.status === "connected",
  );

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
        thumbnailUrl: form.get("thumbnailUrl"),
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

  async function submitPublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublishSubmitting(true);
    setPublishMessage("");
    const form = new FormData(event.currentTarget);
    const scheduledValue = String(form.get("scheduledAt") ?? "");
    const response = await fetch("/api/social/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targets: form.getAll("targets"),
        caption: form.get("caption"),
        mediaUrl: form.get("mediaUrl"),
        title: form.get("title"),
        mode: form.get("mode"),
        privacy: form.get("privacy"),
        scheduledAt: scheduledValue
          ? new Date(scheduledValue).toISOString()
          : null,
        mediaType: form.get("mediaType"),
        shareToFeed: true,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      scheduled?: boolean;
      results?: Array<{ provider: string; error?: string }>;
    };
    setPublishSubmitting(false);
    if (!response.ok && response.status !== 207) {
      setPublishMessage(payload.error ?? "Publishing failed.");
      return;
    }
    if (payload.scheduled) {
      setPublishMessage("Post scheduled.");
      event.currentTarget.reset();
      return;
    }
    const failures = payload.results?.filter((result) => result.error) ?? [];
    setPublishMessage(
      failures.length
        ? `${failures.length} channel${failures.length === 1 ? "" : "s"} need attention.`
        : "Post submitted to every selected channel.",
    );
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    setUploadMessage("Preparing upload…");
    const response = await fetch("/api/media/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    });
    const payload = (await response.json()) as {
      signedUrl?: string;
      publicUrl?: string;
      error?: string;
    };
    if (!response.ok || !payload.signedUrl || !payload.publicUrl) {
      setUploadMessage(payload.error ?? "Upload could not be started.");
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", payload.signedUrl as string);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (progress) => {
          if (progress.lengthComputable) {
            setUploadProgress(
              Math.round((progress.loaded / progress.total) * 100),
            );
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload returned ${xhr.status}.`));
        xhr.onerror = () => reject(new Error("The media upload was interrupted."));
        xhr.send(file);
      });
      setComposePreview((current) => ({
        ...current,
        mediaUrl: payload.publicUrl as string,
      }));
      setUploadProgress(100);
      setUploadMessage("Media uploaded and ready.");
    } catch (error) {
      setUploadMessage(
        error instanceof Error ? error.message : "Media upload failed.",
      );
    }
  }

  async function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuerySubmitting(true);
    setQueryMessage("");
    setQueryResult("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: form.get("query"),
        save: form.get("save") === "on",
        name: form.get("name"),
      }),
    });
    const payload = (await response.json()) as { error?: string; rows?: unknown };
    setQuerySubmitting(false);
    if (!response.ok) {
      setQueryMessage(payload.error ?? "Query failed.");
      return;
    }
    setQueryMessage("Read-only query complete.");
    setQueryResult(JSON.stringify(payload.rows ?? [], null, 2));
  }

  async function submitDeploy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeploySubmitting(true);
    setDeployMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: form.get("provider"),
        project: form.get("project"),
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setDeploySubmitting(false);
    setDeployMessage(
      response.ok
        ? "Deployment triggered."
        : payload.error ?? "Deployment could not be triggered.",
    );
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
                      activity.slice(0, 6).map((event) => (
                        <div className="row" key={`event-${event.id}`}>
                          <span className="row-icon">
                            {event.provider.slice(0, 2).toUpperCase()}
                          </span>
                          <span>
                            <strong>{event.title}</strong>
                            <small>
                              {event.detail
                                ? `${event.detail} · `
                                : ""}
                              {formatSyncTime(event.createdAt, "Recorded")}
                            </small>
                          </span>
                          <span className="pill pill-neutral">{event.kind}</span>
                        </div>
                      ))}
                    {activityFilter !== "scurry" &&
                      connections
                        .filter((connection) => connection.lastSyncedAt)
                        .filter(
                          (connection) =>
                            !activity.some(
                              (event) => event.provider === connection.id,
                            ),
                        )
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
            <>
              <section className="grid-2">
                {social.map((summary) => (
                  <article className="card" key={summary.provider}>
                    <div className="card-heading">
                      <div>
                        <span className="section-kicker">Channel</span>
                        <h2>
                          {summary.provider === "tiktok"
                            ? "TikTok"
                            : summary.provider === "youtube"
                              ? "YouTube"
                              : "Instagram"}
                        </h2>
                      </div>
                      <StatusPill status={summary.status} />
                    </div>
                    {summary.status === "connected" ? (
                      <>
                        <p className="account-name">
                          {summary.accountName ?? "Connected account"}
                        </p>
                        <div className="metric-list">
                          {summary.metrics.map((metric) => (
                            <div className="metric-row" key={metric.label}>
                              <span>{metric.label}</span>
                              <strong>
                                {typeof metric.value === "number"
                                  ? formatCount(metric.value)
                                  : metric.value}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="empty">
                        <strong>
                          {summary.configured
                            ? "Ready to authorize."
                            : "Developer setup required."}
                        </strong>
                        {summary.error ?? "Connect the account to start syncing."}
                        {summary.configured ? (
                          <a className="btn btn-primary empty-action" href={summary.connectPath}>
                            Connect account
                          </a>
                        ) : null}
                      </div>
                    )}
                  </article>
                ))}
              </section>
              <section className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Channels</span><h2>Connection registry</h2></div>
                </div>
                <ConnectionGrid connections={byKind("social")} />
              </section>
            </>
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
                        {latestDeployment.projectName} · {latestDeployment.branch}
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

              <section className="grid-2">
                <article className="card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">Source control</span>
                      <h2>GitHub repositories</h2>
                    </div>
                    <StatusPill status={github.status} />
                  </div>
                  {github.status === "connected" ? (
                    <>
                      <div className="metric-list">
                        <div className="metric-row">
                          <span>Repositories</span>
                          <strong>{github.repositories.length}</strong>
                        </div>
                        <div className="metric-row">
                          <span>Open pull requests</span>
                          <strong>{github.openPullRequests}</strong>
                        </div>
                        <div className="metric-row">
                          <span>Failing workflows</span>
                          <strong>{github.failingWorkflows}</strong>
                        </div>
                      </div>
                      <div className="row-list compact-list">
                        {github.repositories.slice(0, 5).map((repository) => (
                          <div className="row" key={repository.id}>
                            <span className="row-icon">GH</span>
                            <span>
                              <a
                                className="row-link"
                                href={repository.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {repository.fullName}
                              </a>
                              <small>{repository.openPullRequests} open PRs</small>
                            </span>
                            <span className="pill pill-neutral">
                              {repository.latestWorkflowStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty">
                      <strong>GitHub App setup required.</strong>
                      {github.error}
                    </div>
                  )}
                </article>

                <article className="card">
                  <div className="card-heading">
                    <div>
                      <span className="section-kicker">Edge infrastructure</span>
                      <h2>Cloudflare projects</h2>
                    </div>
                    <StatusPill status={cloudflare.status} />
                  </div>
                  {cloudflare.status === "connected" ? (
                    <>
                      <div className="metric-list">
                        <div className="metric-row">
                          <span>Workers</span>
                          <strong>{cloudflare.workerCount}</strong>
                        </div>
                        <div className="metric-row">
                          <span>Pages projects</span>
                          <strong>{cloudflare.pagesCount}</strong>
                        </div>
                        <div className="metric-row">
                          <span>Healthy</span>
                          <strong>{cloudflare.healthyCount}</strong>
                        </div>
                      </div>
                      <div className="row-list compact-list">
                        {cloudflare.projects.slice(0, 5).map((project) => (
                          <div className="row" key={`${project.kind}-${project.name}`}>
                            <span className="row-icon">CF</span>
                            <span>
                              <strong>{project.name}</strong>
                              <small>{project.kind}</small>
                            </span>
                            <span className="pill pill-neutral">{project.status}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty">
                      <strong>Cloudflare setup required.</strong>
                      {cloudflare.error}
                    </div>
                  )}
                </article>
              </section>

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
                  <span className="health-note">
                    {connectedSocial.length} channels ready
                  </span>
                </div>
                <form
                  className="task-form"
                  onSubmit={submitPublish}
                  onInput={(event) => {
                    const form = new FormData(event.currentTarget);
                    setComposePreview({
                      caption: String(form.get("caption") ?? ""),
                      title: String(form.get("title") ?? ""),
                      mediaUrl: String(form.get("mediaUrl") ?? ""),
                      targets: form.getAll("targets").map(String),
                    });
                  }}
                >
                  <div className="channel-options" aria-label="Publish targets">
                    {social.map((summary) => (
                      <label className="check-option" key={summary.provider}>
                        <input
                          type="checkbox"
                          name="targets"
                          value={summary.provider}
                          disabled={summary.status !== "connected"}
                        />
                        {summary.provider === "tiktok"
                          ? "TikTok"
                          : summary.provider === "youtube"
                            ? "YouTube"
                            : "Instagram"}
                      </label>
                    ))}
                  </div>
                  <label>
                    Caption
                    <textarea
                      name="caption"
                      required
                      maxLength={2200}
                      placeholder="Write once, then publish to selected channels."
                    />
                  </label>
                  <label>
                    Upload media
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png"
                      onChange={uploadMedia}
                    />
                  </label>
                  {uploadMessage ? (
                    <div className="upload-status" role="status">
                      <progress max={100} value={uploadProgress} />
                      <span>{uploadMessage}</span>
                    </div>
                  ) : null}
                  <label>
                    Direct media URL
                    <input
                      name="mediaUrl"
                      type="url"
                      required
                      value={composePreview.mediaUrl}
                      onChange={(event) =>
                        setComposePreview((current) => ({
                          ...current,
                          mediaUrl: event.currentTarget.value,
                        }))
                      }
                      placeholder="https://your-verified-domain.com/video.mp4"
                    />
                  </label>
                  <label>
                    YouTube thumbnail URL
                    <input
                      name="thumbnailUrl"
                      type="url"
                      placeholder="https://your-domain.com/thumbnail.jpg"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Video title
                      <input name="title" maxLength={100} placeholder="YouTube title" />
                    </label>
                    <label>
                      Publish mode
                      <select name="mode" defaultValue="draft">
                        <option value="draft">Draft / private</option>
                        <option value="direct">Direct publish</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-grid">
                    <label>
                      Media type
                      <select name="mediaType" defaultValue="video">
                        <option value="video">Video</option>
                        <option value="image">Image</option>
                      </select>
                    </label>
                    <label>
                      Schedule
                      <input name="scheduledAt" type="datetime-local" />
                    </label>
                  </div>
                  <label>
                    Privacy
                    <select name="privacy" defaultValue="SELF_ONLY">
                      <option value="SELF_ONLY">Private / self only</option>
                      <option value="PUBLIC_TO_EVERYONE">Public</option>
                      <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
                    </select>
                  </label>
                  <div className="preview-grid" aria-label="Channel previews">
                    {composePreview.targets.length ? (
                      composePreview.targets.map((provider) => (
                        <div className="channel-preview" key={provider}>
                          <span className="section-kicker">{provider}</span>
                          <strong>
                            {composePreview.title ||
                              composePreview.caption.slice(0, 60) ||
                              "Untitled post"}
                          </strong>
                          <p>
                            {composePreview.caption ||
                              "Your caption preview will appear here."}
                          </p>
                          <small>
                            {mediaHost(composePreview.mediaUrl)}
                          </small>
                        </div>
                      ))
                    ) : (
                      <div className="channel-preview muted-preview">
                        Select a connected channel to preview its post.
                      </div>
                    )}
                  </div>
                  {connectedSocial.length === 0 ? (
                    <div className="empty compact-empty">
                      Connect at least one social account before publishing.
                    </div>
                  ) : null}
                  <div className="form-actions">
                    <span role="status">{publishMessage}</span>
                    <button
                      className="btn btn-primary"
                      disabled={publishSubmitting || connectedSocial.length === 0}
                    >
                      {publishSubmitting ? "Submitting…" : "Publish"}
                    </button>
                  </div>
                </form>
              </article>
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Ops</span><h2>Run a query</h2></div>
                </div>
                <form className="task-form" onSubmit={submitQuery}>
                  {savedQueries.length ? (
                    <label>
                      Saved query
                      <select
                        defaultValue=""
                        onChange={(event) => {
                          const selected = savedQueries.find(
                            (query) => query.id === event.currentTarget.value,
                          );
                          if (selected) setQueryDraft(selected.query);
                        }}
                      >
                        <option value="">Choose a saved query</option>
                        {savedQueries.map((query) => (
                          <option value={query.id} key={query.id}>
                            {query.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    Read-only SQL
                    <textarea
                      name="query"
                      required
                      value={queryDraft}
                      onChange={(event) => setQueryDraft(event.currentTarget.value)}
                      placeholder="select status, count(*) from tasks group by status"
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Saved name
                      <input name="name" maxLength={80} placeholder="Optional query name" />
                    </label>
                    <label className="check-option save-option">
                      <input type="checkbox" name="save" />
                      Save this query
                    </label>
                  </div>
                  <div className="form-actions">
                    <span role="status">{queryMessage}</span>
                    <button className="btn btn-primary" disabled={querySubmitting}>
                      {querySubmitting ? "Running…" : "Run query"}
                    </button>
                  </div>
                  {queryResult ? (
                    <pre className="query-result">{queryResult}</pre>
                  ) : null}
                </form>
              </article>
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Deploy</span><h2>Trigger a build</h2></div>
                </div>
                <form className="task-form" onSubmit={submitDeploy}>
                  <label>
                    Provider
                    <select name="provider" defaultValue="vercel">
                      <option value="vercel">Vercel</option>
                      <option value="cloudflare">Cloudflare</option>
                    </select>
                  </label>
                  <label>
                    Project key
                    <input
                      name="project"
                      required
                      placeholder="The key used in deploy hooks JSON"
                    />
                  </label>
                  <div className="form-actions">
                    <span role="status">{deployMessage}</span>
                    <button className="btn btn-primary" disabled={deploySubmitting}>
                      {deploySubmitting ? "Triggering…" : "Trigger build"}
                    </button>
                  </div>
                </form>
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
