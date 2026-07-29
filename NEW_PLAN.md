# Intentional HQ — Rebuild Plan

Status: proposed 2026-07-27. Supersedes ad-hoc backlog in PLAN.md for the UI/UX
+ architecture push. Assumes Next 16 / React 19 / Tailwind 4 / Supabase, all
already in place.

## Diagnosis (what's actually holding this back)

1. **One giant client component.** `app/dashboard.tsx` is 1316 lines — nav +
   5 sections + 4 write-back forms + all state. Cannot iterate safely.
2. **Actions is a dumping ground.** Add-task, compose, query, and deploy are
   four large forms stacked in a 2-col grid. No flow, no focus.
3. **Overview shows numbers, not a story.** Four stat tiles + two metric
   cards + a stitched-together activity feed. Nothing tells the owner
   *what needs their attention right now*.
4. **No cross-surface primitive.** No command palette, no keyboard nav, no
   toasts, no search — the three things a real HQ lives on.
5. **Fetch-then-reload state model.** `submitTask` ends with
   `window.location.reload()`. Not what you want in 2026.
6. **Registry is hardcoded 8 rows** in `hq-data.ts`. Adding Slack / Linear /
   Stripe / Plausible today means editing three files.
7. **CSS is bifurcated.** 714-line `globals.css` sits next to Tailwind 4 with
   no shared design tokens layer. Every new component reinvents styles.
8. **Query result is a `<pre>` JSON dump.** Deploy asks you to type a
   project key by hand. Compose has no queue view. These are all fixable.

## Phase 1 — Refactor to unblock (1–2 sessions)

Goal: never touch a 1000-line file again.

- **Split `dashboard.tsx`** into:
  - `app/(hq)/layout.tsx` — sidebar + topbar
  - `app/(hq)/page.tsx` — Overview
  - `app/(hq)/data/page.tsx`, `social/page.tsx`, `sites/page.tsx`,
    `actions/page.tsx` — real routes, parallel data loading, streaming
    via `loading.tsx` per segment.
- **Extract primitives** to `app/_components/ui/`:
  `Card`, `StatusPill`, `MetricRow`, `ConnectionTile`, `EmptyState`,
  `SectionHeading`, `Pill`, `RowList`.
- **Extract forms** to `app/_components/forms/`:
  `TaskForm`, `ComposeForm`, `QueryRunner`, `DeployTrigger`.
- **Server Actions replace `fetch('/api/...')`** for task, publish, query,
  deploy. Kill the JSON round-trip and the `window.location.reload()`.
  Use `revalidatePath` / `revalidateTag`.
- **One design-token file.** Move the CSS variables from `globals.css` into
  `@theme` (Tailwind 4). Convert bespoke classes (`.card`, `.pill`, `.row`,
  `.stat`) into React components using utility classes. Target: cut
  `globals.css` by 70%.
- **Registry becomes data-driven.** `app/_config/connections.ts` exports the
  registry; each entry declares `{ id, name, kind, mark, loader,
  connectAction }`. `getDashboardData` maps over it instead of the current
  if/else ladder in `hq-data.ts`.

**Definition of done for Phase 1:** identical UX, but the diff for adding a
new integration is one file.

## Phase 2 — Make it feel like an HQ (2–3 sessions)

Goal: the owner opens this and immediately knows what to do.

- **Overview → "Morning briefing"** replaces the four stat tiles with:
  1. **State of the union** — 3 auto-generated sentences from live data
     ("Scurry grew by 42 users this week. Latest deploy failed 14 min ago.
     TikTok token expires in 3 days.").
  2. **Attention list** — everything broken or blocking, one row each,
     inline action button. Derived from: failed deploys, disconnected
     accounts, tokens near expiry, scheduled posts within 24h, tasks
     overdue, GitHub failing workflows.
  3. **Today** — scurry tasks + calendar entries + scheduled posts.
  4. **Pulse** — 4 sparklines: signups/day, tasks/day, deploys/day,
     social reach/day. Use tiny inline SVGs, no chart library.
- **Command palette (Cmd-K)** — `app/_components/CommandPalette.tsx`. Actions:
  jump to section, add task, start compose, run saved query, trigger
  deploy, open any connected repo/project. Registered via a small
  `useCommands()` hook so each surface can contribute its own verbs.
- **Real-time via Supabase channels** — replace reload-after-submit with
  `supabase.channel('activity').on('postgres_changes', ...)` subscriptions
  on `activity` and `scurry.tasks`. Add a shared `useLiveList` hook.
- **Toasts** — one `Toaster` in root layout. Kill the `<span role="status">`
  inline messages.
- **Compose → its own route** `/actions/compose` with:
  - Split view: form on left, per-channel live preview on right (TikTok,
    YouTube Short, Instagram Reel — each rendered in a channel-shaped
    frame).
  - Drag/drop uploader (reuse existing signed-URL flow).
  - Schedule queue below: list of scheduled posts, cancel/edit inline.
- **Query runner upgrade**:
  - Result renders as a real table with column sort + CSV copy button.
  - Query history in a right rail (last 20, from `saved_queries` +
    ephemeral session-only).
  - Autocomplete on table names by reading `information_schema` once at
    open.
- **Deploy trigger** — replace free-text "project key" with a picker
  sourced from `vercel.projects` + `cloudflare.projects`. Show last
  deploy status inline.
- **Activity feed** — one normalized model, one component, real search
  box + filter chips. Kill the three-source stitching in
  `dashboard.tsx:592-645`.

## Phase 3 — New surface area (as needed)

Only pull these in once Phase 2 lands.

- **`/inbox`** — unified: PR reviews requested, failing workflows,
  disconnected accounts, posts about to publish, tasks due today.
  Everything is a row with a primary action.
- **`/calendar`** — week grid. Scheduled posts, deploy freezes, due
  tasks, holidays. Drag to reschedule (posts + tasks only).
- **`/insights`** — derived: signup → activation funnel, task completion
  rate, cross-channel reach. This is where you *earn* the HQ name.
- **More connectors** — Slack, Linear, Stripe, Plausible, Posthog. Each
  is one file in `app/integrations/` + one row in
  `app/_config/connections.ts`.
- **Outbound notifications** — a `notify()` server util that fans an
  event to Slack/email when: deploy fails, connection breaks, scheduled
  post fails, token expires in <48h.
- **Read-only share links** — signed URL that renders Overview with your
  identity stripped. Useful for investor updates.

## Cross-cutting polish (steal opportunistically)

- Skeleton loaders for every streamed segment.
- Keyboard shortcuts: `g o / g d / g s / g x / g a` for section jumps,
  `c` for compose, `t` for task, `/` for palette.
- Onboarding: first-run wizard walking through the 8 connectors.
- Empty-state art in the Scurry family (single-color line drawings).
- One E2E test per section (Playwright, golden path only).
- Type checks + a smoke `npm run build` gate in the pre-push hook.

## Sequencing recommendation for the next session

Start Phase 1 with **just three moves**, in this order:

1. Move CSS vars into `@theme` and delete the color duplication in
   `globals.css`. Cheapest, unlocks everything.
2. Split `dashboard.tsx` into `_components/` and per-section files —
   route conversion can come later; components first.
3. Convert `submitTask` and `submitDeploy` to server actions to prove
   the pattern.

That's a solid PR on its own and sets up Phase 2 cleanly.
