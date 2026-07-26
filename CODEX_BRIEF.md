# Brief for Codex — Intentional HQ

Read this **and** `PLAN.md` before touching anything in `app/`.

## Start here (order of operations)

1. Read `PLAN.md` end-to-end. It is the roadmap. Do not skip ahead.
2. Read `app/globals.css` and `app/page.tsx` — that's the current
   scurry-matched baseline. Do not restyle it, do not "improve" it,
   do not swap the palette.
3. Your first real task is **PLAN.md → "What to build next" → Step 1
   (Real auth + real backend)**, then **Step 2 (scurry Supabase
   read-only)**. Do those in order. Do not jump to socials, sites,
   or the video studio until Step 2 renders real data from a real
   Supabase in the Overview section.
4. Before every commit, re-check the Rules below and the "Visual rules
   (locked)" section in `PLAN.md`. If a change violates either, revert
   it — even if the user asked for it in the moment. Ask first.
5. When a step is done, update `PLAN.md` to mark it done (strike-through
   or a `[x]` prefix), and note anything future-you needs to know.

If a required credential (Supabase URL/key, OAuth client, etc.) is not
in the repo or `.env`, **stop and ask the user for it** — do not stub
it, do not hardcode a placeholder, do not skip the step.

## What this app is

A management home base. It reads and writes to real services: Supabase,
social APIs, GitHub, Vercel, Cloudflare. It is **not** a landing page, a
pitch deck, or a demo of what the product could be.

## Why the previous pass was rejected

You produced a beautiful-looking screen that lied. Every number was fake —
"Waitlist 1,284," "Projected MRR $8,420," "Founder stories converting 2.4×
better." Bar charts with invented heights. A donut chart of invented
traffic sources. A hero card announcing an insight the app has no way of
knowing. A "Preview mode" pill was the tell.

Real dashboards, before any integration exists, show **zero** — with an
empty state that tells the user what to connect first. That is not less
work than a fake chart. It is different work, and it is the required work.

## Rules

1. **Never invent data.** If the value comes from a source that isn't wired
   yet, render an empty state or a "not connected" pill. Do not fill it in
   with a plausible-looking placeholder.
2. **Match the scurry design system.** See `PLAN.md` → "Visual rules
   (locked)" and the tokens in `app/globals.css`. Reference the source of
   truth at `C:\Users\akmci\Documents\GitHub\task-os\src\app\globals.css`
   (read-only). Warm paper, charcoal ink, one amber accent, quiet cards,
   dark mode. No deep-green sidebars, no coral accents, no orbits or
   countdowns.
3. **Density.** Task-os feels calm because it uses 10-12px row padding, 12
   px card gaps, and 13px body text. Don't inflate spacing to fill screen.
4. **One accent color.** `--accent` (amber). Status pills use
   `pill-live` / `pill-warn` / `pill-off`. Do not introduce a new hue.
5. **Empty states are UI.** Use the `.empty` class. Tell the user what to
   connect and why.
6. **No hero pitch cards.** No "Insight worth noticing." No "47 days to
   make it count." No gradient-heavy trophy panels. Cards represent
   controllable resources, not marketing copy.
7. **Sections are jobs, not chapters.** Overview, Data, Social, Sites,
   Actions. If you need a new section, it must map to a class of resource
   the user can connect or control.
8. **Real integrations before polish.** Do not add a second visual pass
   before there is one working end-to-end connection (recommend scurry
   Supabase first — see PLAN.md step 2).

## `vendor/` folder — hands off

`vendor/` holds third-party reference code. Right now it contains
`vendor/react-video-editor/` (a shallow clone of designcombo/react-video-editor,
MIT). Rules:

- **Do not edit anything in `vendor/`.**
- **Do not import from `vendor/` into `app/`.** It is excluded from
  `tsconfig.json` and `eslint.config.mjs` on purpose — treat it as
  read-only reference material.
- When we're ready to build the Studio section, **copy** the specific
  files/components we need into a new `app/studio/` route, adapt them
  to the scurry design tokens in `app/globals.css`, and add whatever
  npm deps they need to our own `package.json`. Do not add `vendor/`
  itself to the workspace.
- Do not run `npm install` inside `vendor/react-video-editor/`, do not
  add it as a workspace, do not run its dev server, do not delete it.

If you think we should promote a vendored dep into a real one, say so
and wait for a decision — don't do it silently.

## When you're unsure

- Look at `task-os/src/app/(app)/layout.tsx` and any component under
  `task-os/src/components/` for spacing and shape. Match it.
- If the requested feature would require inventing data, stop and say so.
  Suggest the integration that would make it real.

## What "done" looks like for a UI task

- Renders in both light and dark mode without token-less colors.
- All numbers are either from a real source or shown as an empty state.
- No new palette entries, no new fonts, no new shadow styles beyond the
  ones in `globals.css`.
- Fits the density of task-os side-by-side.
