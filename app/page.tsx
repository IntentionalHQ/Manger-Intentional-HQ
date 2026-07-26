"use client";

import { FormEvent, useMemo, useState } from "react";

type Section = "overview" | "content" | "analytics" | "connections";
type PostItem = {
  id: number;
  title: string;
  channel: string;
  date: string;
  status: "Ready" | "Draft" | "Review";
  tone: string;
};

const navItems: { id: Section; label: string; mark: string }[] = [
  { id: "overview", label: "Overview", mark: "⌂" },
  { id: "content", label: "Content", mark: "✦" },
  { id: "analytics", label: "Analytics", mark: "↗" },
  { id: "connections", label: "Connections", mark: "◎" },
];

const metrics = [
  { label: "Waitlist", value: "1,284", change: "+18.6%", note: "this month" },
  { label: "Activation", value: "62.4%", change: "+4.1%", note: "vs. last week" },
  { label: "Projected MRR", value: "$8,420", change: "+12.8%", note: "at launch" },
  { label: "Social reach", value: "184K", change: "+23.2%", note: "last 30 days" },
];

const channelData = [
  { name: "Instagram", handle: "@intentional", reach: "82.4K", delta: "+26%", tone: "coral" },
  { name: "LinkedIn", handle: "Intentional", reach: "54.1K", delta: "+18%", tone: "blue" },
  { name: "TikTok", handle: "@intentionalapp", reach: "47.8K", delta: "+31%", tone: "ink" },
];

const initialPosts: PostItem[] = [
  { id: 1, title: "The problem we couldn’t ignore", channel: "Instagram · LinkedIn", date: "Tomorrow · 9:30 AM", status: "Ready", tone: "coral" },
  { id: 2, title: "A calmer way to run your week", channel: "TikTok · Instagram", date: "Mon · 12:00 PM", status: "Review", tone: "mint" },
  { id: 3, title: "Behind the build: week 08", channel: "LinkedIn", date: "Wed · 8:45 AM", status: "Draft", tone: "sand" },
];

const launchTasks = [
  { id: 1, label: "Approve launch-day story sequence", owner: "Content", done: false },
  { id: 2, label: "Review onboarding activation event", owner: "Product", done: true },
  { id: 3, label: "Record 30-second product walkthrough", owner: "Creative", done: false },
  { id: 4, label: "Invite the next 25 beta members", owner: "Growth", done: false },
];

const traffic = [
  { label: "Direct", value: 34, color: "var(--green)" },
  { label: "Instagram", value: 27, color: "var(--coral)" },
  { label: "LinkedIn", value: 22, color: "var(--blue)" },
  { label: "Other", value: 17, color: "var(--sand)" },
];

export default function Home() {
  const [section, setSection] = useState<Section>("overview");
  const [posts, setPosts] = useState(initialPosts);
  const [tasks, setTasks] = useState(launchTasks);
  const [composerOpen, setComposerOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [connected, setConnected] = useState(["Instagram", "LinkedIn"]);

  const completedTasks = tasks.filter((task) => task.done).length;
  const sectionLabel = navItems.find((item) => item.id === section)?.label ?? "Overview";

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  }

  function toggleConnection(name: string) {
    setConnected((current) => {
      const isConnected = current.includes(name);
      showToast(isConnected ? `${name} disconnected` : `${name} connected for preview`);
      return isConnected ? current.filter((item) => item !== name) : [...current, name];
    });
  }

  function schedulePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("caption") || "").trim();
    const channel = String(form.get("channel") || "Instagram");
    if (!title) return;
    setPosts((current) => [
      {
        id: Date.now(),
        title,
        channel,
        date: "Scheduled · Jul 29, 10:00 AM",
        status: "Ready",
        tone: "mint",
      },
      ...current,
    ]);
    setComposerOpen(false);
    showToast("Post added to your publishing queue");
  }

  const pageCopy = useMemo(() => {
    if (section === "content") return ["Content studio", "Plan once, shape each post for its channel."];
    if (section === "analytics") return ["Growth signals", "See which efforts are creating real momentum."];
    if (section === "connections") return ["Connected workspace", "Keep every signal flowing into one calm view."];
    return ["Your launch, in one view", "The signals, stories, and next moves that matter today."];
  }, [section]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">I</span>
          <span>intentional<span className="brand-dot">.</span></span>
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <button
              className={section === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? "page" : undefined}
            >
              <span className="nav-mark">{item.mark}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-launch">
          <div className="launch-orbit" aria-hidden="true">
            <span>47</span>
          </div>
          <p>Public launch</p>
          <strong>September 10</strong>
          <div className="mini-progress"><span /></div>
          <small>62% launch-ready</small>
        </div>

        <button className="profile-button" aria-label="Open workspace profile">
          <span className="avatar">IH</span>
          <span><strong>Founder workspace</strong><small>Preview mode</small></span>
          <span aria-hidden="true">•••</span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{sectionLabel} / Launch workspace</p>
            <h1>{pageCopy[0]}</h1>
            <p className="subhead">{pageCopy[1]}</p>
          </div>
          <div className="top-actions">
            <span className="preview-pill"><span /> Preview data</span>
            <button className="secondary-button" onClick={() => setSection("content")}>View calendar</button>
            <button className="primary-button" onClick={() => setComposerOpen(true)}>
              <span aria-hidden="true">＋</span> Create post
            </button>
          </div>
        </header>

        {section === "overview" && (
          <>
            <section className="metrics-grid" aria-label="Key metrics">
              {metrics.map((metric) => (
                <article className="metric-card" key={metric.label}>
                  <div className="metric-top">
                    <span>{metric.label}</span>
                    <button aria-label={`More options for ${metric.label}`}>•••</button>
                  </div>
                  <div className="metric-value">{metric.value}</div>
                  <p><strong>{metric.change}</strong> {metric.note}</p>
                </article>
              ))}
            </section>

            <section className="overview-grid">
              <article className="launch-card">
                <div className="card-heading">
                  <div><span className="section-kicker">Launch pulse</span><h2>47 days to make it count.</h2></div>
                  <span className="status-badge">On track</span>
                </div>
                <div className="launch-visual">
                  <div className="launch-number">
                    <span>47</span>
                    <small>days</small>
                  </div>
                  <div className="launch-detail">
                    <p>Momentum is building. Your strongest signal this week is waitlist conversion from founder-led content.</p>
                    <div className="progress-copy"><span>Launch readiness</span><strong>62%</strong></div>
                    <div className="progress-track"><span /></div>
                    <div className="milestones">
                      <span><i className="complete" />Foundation</span>
                      <span><i className="current" />Private beta</span>
                      <span><i />Public launch</span>
                    </div>
                  </div>
                </div>
              </article>

              <article className="tasks-card">
                <div className="card-heading compact">
                  <div><span className="section-kicker">Today’s focus</span><h2>{completedTasks}/{tasks.length} complete</h2></div>
                  <button className="text-button" onClick={() => showToast("Task creation is next on the roadmap")}>Add task</button>
                </div>
                <div className="task-list">
                  {tasks.map((task) => (
                    <label className={task.done ? "task done" : "task"} key={task.id}>
                      <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                      <span className="custom-check" aria-hidden="true">✓</span>
                      <span className="task-copy"><strong>{task.label}</strong><small>{task.owner}</small></span>
                    </label>
                  ))}
                </div>
              </article>
            </section>

            <section className="lower-grid">
              <article className="queue-card">
                <div className="card-heading compact">
                  <div><span className="section-kicker">Coming up</span><h2>Publishing queue</h2></div>
                  <button className="text-button" onClick={() => setSection("content")}>See all <span>→</span></button>
                </div>
                <div className="post-list">
                  {posts.slice(0, 3).map((post) => (
                    <div className="post-row" key={post.id}>
                      <span className={`post-thumb ${post.tone}`}><i /><i /></span>
                      <span className="post-copy"><strong>{post.title}</strong><small>{post.channel} · {post.date}</small></span>
                      <span className={`post-status ${post.status.toLowerCase()}`}>{post.status}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="channels-card">
                <div className="card-heading compact">
                  <div><span className="section-kicker">Last 30 days</span><h2>Channel momentum</h2></div>
                  <button className="text-button" onClick={() => setSection("analytics")}>Details <span>→</span></button>
                </div>
                <div className="channel-list">
                  {channelData.map((channel) => (
                    <div className="channel-row" key={channel.name}>
                      <span className={`channel-icon ${channel.tone}`}>{channel.name.slice(0, 2)}</span>
                      <span><strong>{channel.name}</strong><small>{channel.handle}</small></span>
                      <span><strong>{channel.reach}</strong><small className="positive">{channel.delta}</small></span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        )}

        {section === "content" && (
          <section className="studio-layout">
            <article className="calendar-card">
              <div className="card-heading">
                <div><span className="section-kicker">July 27 – August 2</span><h2>Content calendar</h2></div>
                <button className="primary-button small" onClick={() => setComposerOpen(true)}>＋ New campaign</button>
              </div>
              <div className="week-grid">
                {["MON 27", "TUE 28", "WED 29", "THU 30", "FRI 31", "SAT 01", "SUN 02"].map((day, index) => (
                  <div className={index === 2 ? "day active-day" : "day"} key={day}>
                    <strong>{day}</strong>
                    {index === 0 && <span className="calendar-item coral"><small>9:30 AM</small>Problem story</span>}
                    {index === 2 && <span className="calendar-item mint"><small>10:00 AM</small>Behind the build</span>}
                    {index === 4 && <span className="calendar-item blue"><small>12:00 PM</small>Product tip</span>}
                    {index === 6 && <span className="calendar-item sand"><small>5:00 PM</small>Weekly note</span>}
                  </div>
                ))}
              </div>
            </article>
            <article className="content-pipeline">
              <div className="card-heading compact"><div><span className="section-kicker">Workflow</span><h2>Content pipeline</h2></div></div>
              {posts.map((post) => (
                <div className="pipeline-row" key={post.id}>
                  <span className={`post-thumb ${post.tone}`}><i /><i /></span>
                  <span className="post-copy"><strong>{post.title}</strong><small>{post.channel}</small></span>
                  <span className={`post-status ${post.status.toLowerCase()}`}>{post.status}</span>
                </div>
              ))}
            </article>
          </section>
        )}

        {section === "analytics" && (
          <section className="analytics-layout">
            <article className="chart-card">
              <div className="card-heading">
                <div><span className="section-kicker">Weekly trend</span><h2>Audience growth</h2></div>
                <span className="status-badge">+18.6%</span>
              </div>
              <div className="bar-chart" aria-label="Audience growth over twelve weeks">
                {[28, 34, 31, 42, 48, 45, 55, 62, 68, 65, 78, 92].map((height, index) => (
                  <span key={index} style={{ height: `${height}%` }}><i>{index === 11 ? "1,284" : ""}</i></span>
                ))}
              </div>
              <div className="chart-axis"><span>May 11</span><span>Jun 8</span><span>Jul 6</span><span>Today</span></div>
            </article>
            <article className="traffic-card">
              <div className="card-heading compact"><div><span className="section-kicker">Acquisition</span><h2>Traffic mix</h2></div></div>
              <div className="donut" aria-label="Traffic source breakdown"><span>3,842<small>visits</small></span></div>
              <div className="legend">
                {traffic.map((item) => <div key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><strong>{item.value}%</strong></div>)}
              </div>
            </article>
            <article className="insight-card">
              <span className="insight-mark">✦</span>
              <span className="section-kicker">Signal worth noticing</span>
              <h2>Founder stories are converting 2.4× better.</h2>
              <p>People who arrive from behind-the-scenes posts are more likely to join the waitlist and complete onboarding.</p>
              <button className="secondary-button" onClick={() => setSection("content")}>Plan the next story</button>
            </article>
          </section>
        )}

        {section === "connections" && (
          <section className="connections-layout">
            <article className="connection-intro">
              <span className="section-kicker">Data foundation</span>
              <h2>One workspace. Every important signal.</h2>
              <p>Connect each service through its official authorization flow. Live credentials and real account data will replace this preview in the integration phase.</p>
              <div className="security-note"><span>✓</span><p><strong>Designed for secure connections</strong><small>Encrypted tokens, scoped permissions, and a full activity history.</small></p></div>
            </article>
            <div className="connection-grid">
              {[
                ["Instagram", "Social publishing + insights", "IG"],
                ["LinkedIn", "Company posts + performance", "in"],
                ["TikTok", "Video publishing + analytics", "TT"],
                ["Website analytics", "Traffic + conversion events", "WA"],
                ["Product analytics", "Activation + retention", "PA"],
                ["Billing", "Revenue + subscriptions", "$"],
              ].map(([name, description, mark]) => {
                const isConnected = connected.includes(name);
                return (
                  <article className="connection-card" key={name}>
                    <span className="connection-icon">{mark}</span>
                    <div><h3>{name}</h3><p>{description}</p></div>
                    <button className={isConnected ? "connected-button" : "connect-button"} onClick={() => toggleConnection(name)}>
                      {isConnected ? "✓ Connected" : "Connect"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <footer className="footer">
          <span>Intentional HQ · Preview workspace</span>
          <span>Last refreshed just now</span>
        </footer>
      </main>

      {composerOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setComposerOpen(false);
        }}>
          <section className="composer" role="dialog" aria-modal="true" aria-labelledby="composer-title">
            <div className="composer-head">
              <div><span className="section-kicker">Quick compose</span><h2 id="composer-title">Create a post</h2></div>
              <button className="close-button" onClick={() => setComposerOpen(false)} aria-label="Close composer">×</button>
            </div>
            <form onSubmit={schedulePost}>
              <label>
                Post idea or caption
                <textarea name="caption" required placeholder="Share the story behind what you’re building…" autoFocus />
              </label>
              <div className="form-row">
                <label>Publish to
                  <select name="channel" defaultValue="Instagram · LinkedIn">
                    <option>Instagram · LinkedIn</option>
                    <option>Instagram</option>
                    <option>LinkedIn</option>
                    <option>TikTok</option>
                  </select>
                </label>
                <label>Schedule
                  <input type="datetime-local" defaultValue="2026-07-29T10:00" />
                </label>
              </div>
              <div className="composer-tip"><span>✦</span><p><strong>Keep the core idea consistent.</strong><small>You’ll customize format and tone for each channel during review.</small></p></div>
              <div className="composer-actions">
                <button type="button" className="secondary-button" onClick={() => setComposerOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button">Add to queue →</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}
