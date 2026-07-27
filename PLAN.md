# Intentional HQ — plan going forward

## What this app is

A management home base for everything you run: the scurry Supabase, an ops
Supabase, every social account, every deployed site, every repo. One calm
surface, one design language (matching scurry / task-os), no fake data.

## What was wrong with the codex build

- **It was a pitch deck.** "Waitlist 1,284," "Projected MRR $8,420," "Founder
  stories converting 2.4× better" — all invented, presented as if real. The
  first thing a real dashboard has to do is tell the truth: nothing is
  connected yet.
- **Off-brand.** Deep-green sidebar, coral accent, orbiting-circle countdown
  motif. Scurry is warm paper, charcoal ink, one amber accent, quiet cards.
- **Structure served the pitch, not the work.** "Overview / Content /
  Analytics / Connections" is what you show an investor. The actual jobs are
  Data, Social, Sites, Actions.
- **No dark mode.** Task-os has it; HQ must too.

## What this pass changed

- Rebuilt `app/globals.css` on the scurry token set (paper `#f5f5f0`, ink
  `#2d2d2a`, accent `#F5B800`, muted grays, subtle shadows, dark mode via
  `prefers-color-scheme`).
- Rewrote `app/page.tsx` around real sections (Overview / Data / Social /
  Sites / Actions), with honest empty states and a connection registry that
  starts at 0-of-12.
- Removed all invented metrics, bar charts, donuts, and countdown widgets.
- Added the platform-provided ChatGPT sign-in gate for Sites and Supabase
  magic-link authentication for Vercel.
- Kept the connection registry cross-platform so the same dashboard can run
  on Vercel and Cloudflare/Sites.
- Connected Scurry read-only using its existing Supabase project and the
  signed-in user's matching email.
- Added owner-only aggregate Scurry account, activity, task, and database
  health reporting without exposing other users' task content.
- Connected the current Vercel project for latest and recent deployment
  status.
- Added one controlled write action: capture a new task into Scurry.

## What to build next (in order)

### 1 — Real auth + a real backend — complete
- Supabase magic-link login gates Vercel; Sites uses its owner-only ChatGPT
  authentication.
- The fixed connection catalog stays in code while live statuses come from
  their real services. Move it to a database when connections become editable.

### 2 — First real connection: scurry Supabase (read-only) — complete
- OAuth or PAT into the scurry project.
- Overview shows: today's tasks, overdue count, last sync time.
- Actions: "Add task" → writes to scurry via a server action.
- This proves the end-to-end shape before touching any social API.

### 3 — Social, one at a time — in progress
Priority follows the channels that matter most to the brand:
1. **TikTok** — primary short-form channel. Build OAuth, creator-info checks,
   Direct Post and draft flows through the Content Posting API, upload progress,
   publishing status, and post metrics. Production access requires TikTok app
   review.
2. **YouTube** — primary durable video channel. Build Google OAuth, resumable
   uploads, titles/descriptions/tags, thumbnail upload, scheduled publishing,
   processing status, and video/channel metrics. Public API uploads may require
   a Google compliance audit.
3. **Instagram** — secondary channel. Add Reels and feed publishing plus
   insights after TikTok and YouTube. Use the Instagram API for a professional
   account and complete Meta app review when production access requires it.
4. **Threads** — later, if the Meta application work can be reused efficiently.
5. **LinkedIn** — later, for personal and company updates when professional
   distribution becomes a priority.
6. **X** — only if the paid API tier is justified by measurable results.

For each: store token in the DB encrypted; expose a normalized `publish()`
call and a `metrics()` call. UI never talks to the platform directly.

### 4 — Sites & infra
- GitHub App install: list repos, open PRs, latest workflow run per repo.
- Vercel token: current project deployment status and recent history are
  complete; expand to all projects when more sites are added.
- Cloudflare token: Workers + Pages projects, health.

### 5 — Actions surface
- **Compose**: one post, choose targets, per-channel preview, schedule.
- **Query**: saved SQL against any connected Supabase.
- **Deploy**: kick a Vercel/Cloudflare build.
- **Capture**: add task to scurry from anywhere in HQ — complete.

### 6 — Ambient signal (only after real data flows) — in progress
- Activity feed now combines real Scurry task updates and connection sync
  events with source filters. Add post and deployment events as those
  integrations become live.
- No vanity metrics. Numbers only when they're queryable.

## Future: content studio (video editor)

Not for this pass, but plan the shell to accommodate it. HQ should
eventually double as a lightweight video editor for making the content
that gets published through the Social section — so the pipeline is
capture → edit → schedule → publish → measure, all in one place.

Sketch of what "Studio" would need when we get there:
- Media library backed by object storage (Supabase Storage or R2) —
  clips, b-roll, audio beds, brand overlays, thumbnails.
- Timeline editor: multi-track (video / overlay / captions / audio),
  trim, split, ordering, transitions. Consider `remotion` (React-based,
  server-renderable) or a WASM ffmpeg pipeline; skip a full NLE.
- Auto-captions (Whisper) + burn-in with brand styling.
- Aspect-ratio presets tied to the target channel (9:16 for TikTok /
  Reels / Shorts, 1:1 for feed, 16:9 for YouTube). One edit, multiple
  exports.
- Thumbnail + cover-frame picker, saved per channel.
- "Send to Social composer" hand-off — the finished asset lands in the
  publish queue with the right ratio already picked.
- Render queue: server-side ffmpeg / Remotion worker, progress + retry.

Slot it in as a sixth nav section (`Studio`) once at least one social
account is live, so exports have somewhere real to go.

## Non-goals

- No launch-countdown widget. It's a management app, not a runway.
- No AI-generated "insight" cards until there's real data to insight-ify.
- No PowerPoint-style hero visuals. Every card earns its space by
  representing a real thing the user can act on.

## Visual rules (locked)

- Palette: only the tokens defined in `globals.css`. No new colors without
  updating both light and dark values.
- One accent (`--accent`, amber). Green/red only for `pill-live` /
  `pill-warn` status.
- Corners: 8px (buttons, small chips), 10-12px (cards).
- Shadows: `--card-shadow` only. No colored glows.
- Type: `--font-display` (Manrope) for headings, `--font-body` (DM Sans) for
  everything else. Sizes: h1 22-28px, h2 15px, h3 13px, body 13px, meta 11px.
- Density: task-os feels quiet because rows are 10-12px vertical padding, not
  20. Keep it there.
- Empty states are a first-class UI, not a placeholder. Use `.empty`.
