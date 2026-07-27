# Intentional HQ

Intentional HQ is the cross-platform management home base for Scurry, social
accounts, sites, and operational actions. It runs as standard Next.js on
Vercel and uses [vinext](https://github.com/cloudflare/vinext) for
Cloudflare/Sites.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Runtime configuration

Set these server-side variables in Vercel and Sites:

- `SCURRY_SUPABASE_URL`
- `SCURRY_SUPABASE_PUBLISHABLE_KEY`
- `SCURRY_SUPABASE_SERVICE_ROLE_KEY` (secret)
- `HQ_TIME_ZONE` (for example, `America/New_York`)
- `HQ_TOKEN_ENCRYPTION_KEY` (secret, base64-encoded 32-byte key)

Add the deployed Vercel `/auth/callback` URL to the Scurry Supabase Auth
redirect allowlist. Vercel uses Supabase magic links; the private Sites target
continues to accept its platform-provided ChatGPT identity.

The full connection setup—TikTok, YouTube, Instagram, GitHub, Cloudflare,
deployment hooks, scheduling, and the required Supabase migration—is documented
in [`SETUP_CHECKLIST.md`](SETUP_CHECKLIST.md). Until a service is configured,
the dashboard renders a truthful setup-required state and never substitutes
sample metrics.

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` retains the optional Sites D1 schema for future persistence
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: create the standard Next.js `.next/` output for Vercel
- `npm run build:sites`: create the vinext `dist/` output for Cloudflare/Sites
- `npm test`: build the app and verify the HQ authentication, data, and UI contracts
- `npm run test:sites`: build the Sites target and run the same contracts
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
