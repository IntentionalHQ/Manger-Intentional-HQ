# Intentional HQ — morning activation checklist

The application code is complete. These are the external setup steps that
cannot be performed safely without the owner of each account.

## 1. Intentional HQ Supabase (new, separate project)

- Create a new Supabase project for Intentional HQ. Do not reuse Scurry.
- Add these values to Vercel and Sites:
  - `HQ_SUPABASE_URL`
  - `HQ_SUPABASE_PUBLISHABLE_KEY`
  - `HQ_SUPABASE_SERVICE_ROLE_KEY` (secret)
- Open the new HQ project's **SQL Editor**.
- Run the complete contents of `supabase/hq_integrations.sql`.
- Run the complete contents of `supabase/hq_finance.sql`.
- Open **Storage** and create:
  - a public bucket named `hq-media` for social publishing;
  - a private bucket named `finance-documents` for receipts and records.
- In the HQ project, enable email magic-link authentication and add the
  deployed Vercel `/auth/callback` URL to the redirect allowlist.

The finance page shows an explicit preview until this step is complete. Preview
data is never written to Scurry or to the HQ database.

## 2. Scurry Supabase (reporting source only)

- Open the Scurry project in Supabase.
- Keep `SCURRY_SUPABASE_URL`, `SCURRY_SUPABASE_PUBLISHABLE_KEY`, and the current
  server-only `SCURRY_SUPABASE_SERVICE_ROLE_KEY` configured so the existing
  dashboard can read Scurry while the restricted reporting endpoint is rolled
  out.
- Do not apply either HQ migration to Scurry.
- Before a commercial launch, replace broad service-role reads with a narrowly
  scoped reporting endpoint that exposes only the aggregates HQ needs.

Back in the HQ project:

- Set `HQ_MEDIA_BUCKET` only if you chose a different public media bucket name.
- Set `HQ_FINANCE_DOCUMENTS_BUCKET` only if you chose a different private
  finance-document bucket name.
- Generate one 32-byte encryption key and save the same value in both Vercel
  and Sites as the secret `HQ_TOKEN_ENCRYPTION_KEY`.

PowerShell can generate the key:

```powershell
[Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
)
```

- Generate a separate random secret for `HQ_CRON_SECRET`.
- Never change `HQ_TOKEN_ENCRYPTION_KEY` after accounts are connected unless
  all social accounts are disconnected first; existing tokens would become
  unreadable.

## 3. TikTok

- Create an app at <https://developers.tiktok.com/>.
- Add **Login Kit**, **Content Posting API**, and **Display API**.
- Request:
  - `user.info.basic`
  - `user.info.stats`
  - `video.list`
  - `video.upload`
  - `video.publish`
- Register:
  - `https://manger-intentional-hq-six.vercel.app/api/integrations/tiktok/callback`
  - `https://intentional-brand-hq.akmcintyre120.chatgpt.site/api/integrations/tiktok/callback`
- Add `TIKTOK_CLIENT_KEY` and secret `TIKTOK_CLIENT_SECRET` to Vercel and Sites.
- Verify the domain that will host video files in TikTok's URL properties.
- Complete TikTok's audit when public Direct Post access is needed. Unaudited
  clients are limited to private visibility; draft upload can be used first.

## 4. YouTube

- In Google Cloud Console, enable **YouTube Data API v3**.
- Configure the OAuth consent screen.
- Create a **Web application** OAuth client.
- Register:
  - `https://manger-intentional-hq-six.vercel.app/api/integrations/youtube/callback`
  - `https://intentional-brand-hq.akmcintyre120.chatgpt.site/api/integrations/youtube/callback`
- Add `YOUTUBE_CLIENT_ID` and secret `YOUTUBE_CLIENT_SECRET` to both hosts.
- Add the owner Google account as a test user until the consent screen is
  published.
- Complete Google's verification or YouTube API audit if Google requests it.

## 5. Instagram

- Create or reuse a Meta developer app at <https://developers.facebook.com/>.
- Add **Instagram API with Instagram Login**.
- Connect the professional Instagram account.
- Request:
  - `instagram_business_basic`
  - `instagram_business_content_publish`
  - `instagram_business_manage_insights`
- Register:
  - `https://manger-intentional-hq-six.vercel.app/api/integrations/instagram/callback`
  - `https://intentional-brand-hq.akmcintyre120.chatgpt.site/api/integrations/instagram/callback`
- Add `INSTAGRAM_CLIENT_ID` and secret `INSTAGRAM_CLIENT_SECRET` to both hosts.
- If Meta requires an explicit Graph version, set `INSTAGRAM_GRAPH_VERSION`
  to the version shown in the app dashboard.
- Complete Meta App Review before using permissions outside app-role accounts.

## 6. GitHub

- Create a GitHub App owned by `IntentionalHQ`.
- Give it read access to:
  - Repository metadata
  - Pull requests
  - Actions
- Install it on the repositories Intentional HQ should monitor.
- Generate a private key.
- Add these secrets/values to both hosts:
  - `HQ_GITHUB_APP_ID`
  - `HQ_GITHUB_INSTALLATION_ID`
  - `HQ_GITHUB_PRIVATE_KEY`
- Store the complete PEM private key. When the settings form is single-line,
  replace each real line break with `\n`.

## 7. Vercel

- Keep the existing `HQ_VERCEL_TOKEN`.
- Ensure the token can read every project in the `intentional-hq` team.
- Create a Deploy Hook for each project that should be triggerable.
- Store the hooks in the secret `HQ_VERCEL_DEPLOY_HOOKS_JSON`, keyed by the
  project key used in the dashboard:

```json
{
  "scurry": "https://api.vercel.com/v1/integrations/deploy/...",
  "intentional-hq": "https://api.vercel.com/v1/integrations/deploy/..."
}
```

## 8. Cloudflare

- Create a scoped API token with:
  - Account → Workers Scripts → Read
  - Account → Cloudflare Pages → Read
  - Account → Cloudflare Pages → Edit, only if deployment actions are used
- Add `HQ_CLOUDFLARE_ACCOUNT_ID` and secret
  `HQ_CLOUDFLARE_API_TOKEN` to both hosts.
- Create Pages Deploy Hooks for projects that should be triggerable.
- Store them in secret `HQ_CLOUDFLARE_DEPLOY_HOOKS_JSON`:

```json
{
  "website": "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/..."
}
```

## 9. Scheduling

- Configure a scheduler to send `POST /api/social/scheduled/run`.
- Send `Authorization: Bearer <HQ_CRON_SECRET>`.
- A ten-minute interval is a reasonable default.

## 10. Activate and verify

- Redeploy both Vercel and Sites after adding environment variables.
- Sign in to Intentional HQ.
- Open **Accounting & planning**, create the company workspace, post a small
  test transaction with a receipt, confirm the trial balance is balanced, and
  remove the test with a reversal rather than editing the posted entry.
- Open **Social** and connect TikTok, then YouTube, then Instagram.
- Confirm each channel displays only real account metrics.
- Use draft/private publishing first.
- Open **Sites** and confirm GitHub, Vercel, and Cloudflare inventories.
- Test one read-only query and one deploy hook.
