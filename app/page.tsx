"use client";

import { useMemo, useState } from "react";

type Section = "overview" | "data" | "social" | "sites" | "actions";

const navItems: { id: Section; label: string; mark: string }[] = [
  { id: "overview", label: "Overview", mark: "◐" },
  { id: "data", label: "Data", mark: "▤" },
  { id: "social", label: "Social", mark: "◈" },
  { id: "sites", label: "Sites", mark: "◇" },
  { id: "actions", label: "Actions", mark: "→" },
];

type ConnStatus = "connected" | "not_connected" | "error";
type Connection = {
  id: string;
  name: string;
  kind: "data" | "social" | "site";
  detail: string;
  mark: string;
  status: ConnStatus;
};

const initialConnections: Connection[] = [
  { id: "supabase-scurry", name: "Supabase — scurry", kind: "data", detail: "Primary task-os database", mark: "SB", status: "not_connected" },
  { id: "supabase-hq", name: "Supabase — hq", kind: "data", detail: "Ops + content store", mark: "SB", status: "not_connected" },
  { id: "instagram", name: "Instagram", kind: "social", detail: "Publishing + insights", mark: "IG", status: "not_connected" },
  { id: "linkedin", name: "LinkedIn", kind: "social", detail: "Company page", mark: "in", status: "not_connected" },
  { id: "tiktok", name: "TikTok", kind: "social", detail: "Video publishing", mark: "TT", status: "not_connected" },
  { id: "x", name: "X / Twitter", kind: "social", detail: "Posts + threads", mark: "X", status: "not_connected" },
  { id: "youtube", name: "YouTube", kind: "social", detail: "Uploads + analytics", mark: "YT", status: "not_connected" },
  { id: "threads", name: "Threads", kind: "social", detail: "Cross-post from IG", mark: "Th", status: "not_connected" },
  { id: "bluesky", name: "Bluesky", kind: "social", detail: "AT protocol posts", mark: "Bs", status: "not_connected" },
  { id: "vercel", name: "Vercel", kind: "site", detail: "Deployments + domains", mark: "▲", status: "not_connected" },
  { id: "cloudflare", name: "Cloudflare", kind: "site", detail: "Workers + Pages", mark: "CF", status: "not_connected" },
  { id: "github", name: "GitHub", kind: "site", detail: "Repos, PRs, actions", mark: "GH", status: "not_connected" },
];

function StatusPill({ status }: { status: ConnStatus }) {
  if (status === "connected") return <span className="pill pill-live"><span className="pill-dot" />Live</span>;
  if (status === "error") return <span className="pill pill-warn"><span className="pill-dot" />Error</span>;
  return <span className="pill pill-off"><span className="pill-dot" />Not connected</span>;
}

export default function Home() {
  const [section, setSection] = useState<Section>("overview");
  const [connections, setConnections] = useState(initialConnections);

  const counts = useMemo(() => {
    const total = connections.length;
    const live = connections.filter((c) => c.status === "connected").length;
    const dataLive = connections.filter((c) => c.kind === "data" && c.status === "connected").length;
    const socialLive = connections.filter((c) => c.kind === "social" && c.status === "connected").length;
    const siteLive = connections.filter((c) => c.kind === "site" && c.status === "connected").length;
    return { total, live, dataLive, socialLive, siteLive };
  }, [connections]);

  function toggle(id: string) {
    setConnections((cs) =>
      cs.map((c) => (c.id === id ? { ...c, status: c.status === "connected" ? "not_connected" : "connected" } : c)),
    );
  }

  const byKind = (kind: Connection["kind"]) => connections.filter((c) => c.kind === kind);

  const pageCopy: Record<Section, [string, string]> = {
    overview: ["Home base", "What is connected, what needs attention."],
    data: ["Data sources", "Supabase projects and other stores."],
    social: ["Social accounts", "Every channel in one place."],
    sites: ["Sites & infra", "Deployments, repos, domains."],
    actions: ["Quick actions", "Compose, deploy, sync — from one place."],
  };
  const [title, subhead] = pageCopy[section];

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
          <button className="profile-button" aria-label="Workspace profile">
            <span className="avatar">AM</span>
            <span><strong>Founder workspace</strong><small>Local dev</small></span>
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <header className="topbar">
            <div>
              <p className="eyebrow">{navItems.find((n) => n.id === section)?.label}</p>
              <h1>{title}</h1>
              <p className="subhead">{subhead}</p>
            </div>
            <div className="top-actions">
              <button className="btn btn-outline" onClick={() => setSection("actions")}>Quick action</button>
              <button className="btn btn-primary" onClick={() => setSection("data")}>+ Connect source</button>
            </div>
          </header>

          {section === "overview" && (
            <>
              <section className="stat-grid" aria-label="Connection summary">
                <article className="stat">
                  <div className="stat-label">Connections live</div>
                  <div className="stat-value">{counts.live}<span style={{ color: "var(--text-tertiary)", fontSize: 16, fontWeight: 500 }}> / {counts.total}</span></div>
                  <div className="stat-sub">Across data, social, sites</div>
                </article>
                <article className="stat">
                  <div className="stat-label">Data sources</div>
                  <div className="stat-value">{counts.dataLive}<span style={{ color: "var(--text-tertiary)", fontSize: 16, fontWeight: 500 }}> / {byKind("data").length}</span></div>
                  <div className="stat-sub">Supabase + other stores</div>
                </article>
                <article className="stat">
                  <div className="stat-label">Social accounts</div>
                  <div className="stat-value">{counts.socialLive}<span style={{ color: "var(--text-tertiary)", fontSize: 16, fontWeight: 500 }}> / {byKind("social").length}</span></div>
                  <div className="stat-sub">Publishing + insights</div>
                </article>
                <article className="stat">
                  <div className="stat-label">Sites & infra</div>
                  <div className="stat-value">{counts.siteLive}<span style={{ color: "var(--text-tertiary)", fontSize: 16, fontWeight: 500 }}> / {byKind("site").length}</span></div>
                  <div className="stat-sub">Deployments + repos</div>
                </article>
              </section>

              <section className="grid-2">
                <article className="card">
                  <div className="card-heading">
                    <div><span className="section-kicker">Needs attention</span><h2>Nothing connected yet</h2></div>
                    <StatusPill status="not_connected" />
                  </div>
                  <div className="empty">
                    <strong>Start with your primary Supabase.</strong>
                    Connect the scurry database first so every panel below has something real to read.
                  </div>
                </article>
                <article className="card">
                  <div className="card-heading">
                    <div><span className="section-kicker">Recent activity</span><h2>No events</h2></div>
                  </div>
                  <div className="empty">
                    Activity from connected sources — new rows, posts, deploys — will show up here once a source is wired.
                  </div>
                </article>
              </section>
            </>
          )}

          {section === "data" && (
            <section className="card">
              <div className="card-heading">
                <div><span className="section-kicker">Databases</span><h2>Data sources</h2></div>
                <button className="btn btn-outline">+ Add Supabase project</button>
              </div>
              <div className="conn-grid">
                {byKind("data").map((c) => (
                  <div className="conn" key={c.id}>
                    <span className="conn-icon">{c.mark}</span>
                    <div className="conn-body"><strong>{c.name}</strong><small>{c.detail}</small></div>
                    <button
                      className={c.status === "connected" ? "conn-action connected" : "conn-action"}
                      onClick={() => toggle(c.id)}
                    >
                      {c.status === "connected" ? "✓ Live" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === "social" && (
            <section className="card">
              <div className="card-heading">
                <div><span className="section-kicker">Channels</span><h2>Social accounts</h2></div>
                <button className="btn btn-outline">+ Add channel</button>
              </div>
              <div className="conn-grid">
                {byKind("social").map((c) => (
                  <div className="conn" key={c.id}>
                    <span className="conn-icon">{c.mark}</span>
                    <div className="conn-body"><strong>{c.name}</strong><small>{c.detail}</small></div>
                    <button
                      className={c.status === "connected" ? "conn-action connected" : "conn-action"}
                      onClick={() => toggle(c.id)}
                    >
                      {c.status === "connected" ? "✓ Live" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === "sites" && (
            <section className="card">
              <div className="card-heading">
                <div><span className="section-kicker">Infra</span><h2>Sites & deployments</h2></div>
                <button className="btn btn-outline">+ Add source</button>
              </div>
              <div className="conn-grid">
                {byKind("site").map((c) => (
                  <div className="conn" key={c.id}>
                    <span className="conn-icon">{c.mark}</span>
                    <div className="conn-body"><strong>{c.name}</strong><small>{c.detail}</small></div>
                    <button
                      className={c.status === "connected" ? "conn-action connected" : "conn-action"}
                      onClick={() => toggle(c.id)}
                    >
                      {c.status === "connected" ? "✓ Live" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === "actions" && (
            <section className="grid-2">
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Publish</span><h2>Compose a post</h2></div>
                </div>
                <div className="empty">Composer arrives once a social account is connected.</div>
              </article>
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Ops</span><h2>Run a query</h2></div>
                </div>
                <div className="empty">Query panel arrives once Supabase is connected.</div>
              </article>
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Deploy</span><h2>Trigger a build</h2></div>
                </div>
                <div className="empty">Deploy controls arrive once Vercel or Cloudflare is connected.</div>
              </article>
              <article className="card">
                <div className="card-heading">
                  <div><span className="section-kicker">Task-os</span><h2>Add a task to scurry</h2></div>
                </div>
                <div className="empty">Quick-capture routes to the scurry Supabase once wired.</div>
              </article>
            </section>
          )}

          <footer className="footer">
            <span>Intentional HQ · local</span>
            <span>{counts.live} of {counts.total} sources live</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
