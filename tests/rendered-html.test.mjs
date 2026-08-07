import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("supports protected dashboard access on Sites and Vercel", async () => {
  const [page, data, auth, proxy, packageJson] = await Promise.all([
    readFile(projectFile("app/page.tsx"), "utf8"),
    readFile(projectFile("app/hq-data.ts"), "utf8"),
    readFile(projectFile("app/chatgpt-auth.ts"), "utf8"),
    readFile(projectFile("lib/supabase/proxy.ts"), "utf8"),
    readFile(projectFile("package.json"), "utf8"),
  ]);

  assert.match(page, /requireHQOwner\("\/"\)/);
  assert.match(page, /getDashboardData\(user\.email\)/);
  assert.match(data, /readScurrySummary\(ownerEmail\)/);
  assert.match(data, /readScurryBusinessSummary\(\)/);
  assert.doesNotMatch(data, /cloudflare:workers|env\.DB/);
  assert.match(auth, /oai-authenticated-user-email/);
  assert.match(auth, /supabase\.auth\.getUser\(\)/);
  assert.match(auth, /HQ_OWNER_EMAIL/);
  assert.match(auth, /getHQOwner/);
  assert.match(proxy, /supabase\.auth\.getClaims\(\)/);
  assert.match(packageJson, /"build": "next build"/);
  assert.match(packageJson, /"build:sites": "vinext build"/);
});

test("uses the backend-only Scurry connector for reads and task capture", async () => {
  const [scurry, route] = await Promise.all([
    readFile(projectFile("app/scurry.ts"), "utf8"),
    readFile(projectFile("app/api/tasks/route.ts"), "utf8"),
  ]);

  assert.match(scurry, /import "server-only"/);
  assert.match(scurry, /createClient\(url, serviceRoleKey/);
  assert.match(scurry, /persistSession: false/);
  assert.match(scurry, /client\.auth\.admin\.listUsers/);
  assert.match(scurry, /\.from\("tasks"\)/);
  assert.match(scurry, /SCURRY_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(scurry, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /getHQOwner\(\)/);
  assert.match(route, /Owner access required/);
  assert.match(route, /addScurryTask\(user\.email/);
  assert.match(scurry, /readScurryBusinessSummary/);
  assert.match(scurry, /activeUsers30d/);
  assert.match(scurry, /databaseLatencyMs/);
});

test("ships the five work surfaces without invented launch metrics", async () => {
  const [dashboard, layout, styles, og, logo, icon, appleIcon] = await Promise.all([
    readFile(projectFile("app/dashboard.tsx"), "utf8"),
    readFile(projectFile("app/layout.tsx"), "utf8"),
    readFile(projectFile("app/globals.css"), "utf8"),
    stat(projectFile("public/og.png")),
    stat(projectFile("public/scurry-logo.png")),
    stat(projectFile("app/icon.png")),
    stat(projectFile("app/apple-icon.png")),
  ]);

  for (const label of ["Overview", "Data", "Social", "Sites", "Actions"]) {
    assert.match(dashboard, new RegExp(`label: "${label}"`));
  }
  assert.match(dashboard, /<h2>Add a task<\/h2>/);
  assert.match(dashboard, /Add to Scurry/);
  assert.doesNotMatch(dashboard, /Projected MRR|Waitlist/i);
  assert.match(layout, /Intentional HQ .* Management home base/);
  assert.match(styles, /url\("\/scurry-logo\.png"\)/);
  assert.doesNotMatch(dashboard, /className="brand-mark">H/);
  assert.ok(og.size > 100_000);
  assert.ok(logo.size > 10_000);
  assert.ok(icon.size > 10_000);
  assert.ok(appleIcon.size > 10_000);
});

test("provides a Supabase magic-link flow for Vercel", async () => {
  const [auth, loginPage, login, magicLink, callback] = await Promise.all([
    readFile(projectFile("app/chatgpt-auth.ts"), "utf8"),
    readFile(projectFile("app/login/page.tsx"), "utf8"),
    readFile(projectFile("app/login/login-form.tsx"), "utf8"),
    readFile(projectFile("app/api/auth/magic-link/route.ts"), "utf8"),
    readFile(projectFile("app/auth/callback/route.ts"), "utf8"),
  ]);

  assert.match(auth, /host\.endsWith\("\.vercel\.app"\)/);
  assert.match(auth, /redirect\(`\/login\?returnTo=/);
  assert.match(loginPage, /authConfigured/);
  assert.match(login, /Connect Supabase in Vercel/);
  assert.match(login, /Email me a sign-in link/);
  assert.match(magicLink, /signInWithOtp/);
  assert.match(magicLink, /emailRedirectTo/);
  assert.match(magicLink, /if \(returnTo !== "\/"\)/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /safeReturnPath/);
});

test("limits the social roadmap to TikTok, YouTube, and Instagram", async () => {
  const [data, dashboard, env, social, store, migration] = await Promise.all([
    readFile(projectFile("app/hq-data.ts"), "utf8"),
    readFile(projectFile("app/dashboard.tsx"), "utf8"),
    readFile(projectFile(".env.example"), "utf8"),
    readFile(projectFile("app/integrations/social.ts"), "utf8"),
    readFile(projectFile("app/integrations/store.ts"), "utf8"),
    readFile(projectFile("supabase/hq_integrations.sql"), "utf8"),
  ]);

  for (const channel of ["TikTok", "YouTube", "Instagram"]) {
    assert.match(data, new RegExp(`name: "${channel}"`));
  }
  assert.doesNotMatch(data, /Bluesky|LinkedIn|X \/ Twitter|Threads/);
  assert.doesNotMatch(dashboard, /Bluesky|Publish to Bluesky/);
  assert.doesNotMatch(env, /BLUESKY_/);
  assert.match(social, /publishTikTok/);
  assert.match(social, /publishYouTube/);
  assert.match(social, /publishInstagram/);
  assert.match(store, /encryptSecret/);
  assert.match(store, /hq_scheduled_posts/);
  assert.match(store, /hq_saved_queries/);
  assert.match(migration, /hq_connections/);
  assert.match(migration, /hq_run_readonly_query/);
  assert.match(dashboard, /Connect account/);
  assert.match(dashboard, /Direct media URL/);
  assert.match(dashboard, /YouTube thumbnail URL/);
  assert.match(dashboard, /Channel previews/);
  assert.match(dashboard, /Saved query/);
});

test("keeps OAuth, publishing, uploads, queries, and deploy actions owner-only", async () => {
  const [connect, callback, publish, upload, query, deploy, scheduled] =
    await Promise.all([
      readFile(projectFile("app/api/integrations/[provider]/connect/route.ts"), "utf8"),
      readFile(projectFile("app/api/integrations/[provider]/callback/route.ts"), "utf8"),
      readFile(projectFile("app/api/social/publish/route.ts"), "utf8"),
      readFile(projectFile("app/api/media/upload-url/route.ts"), "utf8"),
      readFile(projectFile("app/api/query/route.ts"), "utf8"),
      readFile(projectFile("app/api/deploy/route.ts"), "utf8"),
      readFile(projectFile("app/api/social/scheduled/run/route.ts"), "utf8"),
    ]);

  for (const route of [connect, callback, publish, upload, query, deploy, scheduled]) {
    assert.match(route, /getHQOwner/);
  }
  assert.match(callback, /validOauthState/);
  assert.match(publish, /schedulePost/);
  assert.match(upload, /createMediaUpload/);
  assert.match(query, /runReadOnlyQuery/);
  assert.match(deploy, /allowedHook/);
  assert.match(scheduled, /HQ_CRON_SECRET/);
});

test("monitors GitHub, all Vercel projects, and Cloudflare", async () => {
  const [github, vercel, cloudflare, data, dashboard] = await Promise.all([
    readFile(projectFile("app/github.ts"), "utf8"),
    readFile(projectFile("app/vercel.ts"), "utf8"),
    readFile(projectFile("app/cloudflare.ts"), "utf8"),
    readFile(projectFile("app/hq-data.ts"), "utf8"),
    readFile(projectFile("app/dashboard.tsx"), "utf8"),
  ]);

  assert.match(github, /installation\/repositories/);
  assert.match(github, /actions\/runs/);
  assert.match(github, /pulls\?state=open/);
  assert.match(vercel, /\/v9\/projects/);
  assert.match(cloudflare, /workers\/scripts/);
  assert.match(cloudflare, /pages\/projects/);
  assert.match(data, /readGitHubSummary/);
  assert.match(data, /readCloudflareSummary/);
  assert.match(dashboard, /GitHub repositories/);
  assert.match(dashboard, /Cloudflare projects/);
});

test("shows real, filterable Scurry activity", async () => {
  const [scurry, dashboard] = await Promise.all([
    readFile(projectFile("app/scurry.ts"), "utf8"),
    readFile(projectFile("app/dashboard.tsx"), "utf8"),
  ]);

  assert.match(scurry, /updatedAt: task\.updated_at/);
  assert.match(dashboard, /activityFilter/);
  assert.match(dashboard, /Updated/);
  assert.match(dashboard, /Filter activity/);
});

test("shows owner metrics and read-only Vercel deployment monitoring", async () => {
  const [vercel, data, dashboard] = await Promise.all([
    readFile(projectFile("app/vercel.ts"), "utf8"),
    readFile(projectFile("app/hq-data.ts"), "utf8"),
    readFile(projectFile("app/dashboard.tsx"), "utf8"),
  ]);

  assert.match(vercel, /import "server-only"/);
  assert.match(vercel, /HQ_VERCEL_TOKEN/);
  assert.match(vercel, /https:\/\/api\.vercel\.com/);
  assert.match(vercel, /method:\s*"GET"|fetch\(/);
  assert.doesNotMatch(vercel, /method:\s*"(POST|PATCH|PUT|DELETE)"/);
  assert.match(data, /readVercelSummary\(\)/);
  assert.match(dashboard, /Total Scurry users/);
  assert.match(dashboard, /Active users/);
  assert.match(dashboard, /Latest Vercel deployment/);
  assert.match(dashboard, /Database health/);
});

test("keeps accounting in a separate HQ database and ships the finance surface", async () => {
  const [financePage, financeUi, financeData, hqAdmin, env, migration, store, journal, reversal, close, receipts] = await Promise.all([
    readFile(projectFile("app/finance/page.tsx"), "utf8"),
    readFile(projectFile("app/finance/finance-dashboard.tsx"), "utf8"),
    readFile(projectFile("app/finance/data.ts"), "utf8"),
    readFile(projectFile("lib/supabase/hq-admin.ts"), "utf8"),
    readFile(projectFile(".env.example"), "utf8"),
    readFile(projectFile("supabase/hq_finance.sql"), "utf8"),
    readFile(projectFile("app/integrations/store.ts"), "utf8"),
    readFile(projectFile("app/api/finance/journal-entries/route.ts"), "utf8"),
    readFile(projectFile("app/api/finance/journal-entries/[id]/reverse/route.ts"), "utf8"),
    readFile(projectFile("app/api/finance/periods/close/route.ts"), "utf8"),
    readFile(projectFile("app/api/finance/receipts/route.ts"), "utf8"),
  ]);

  assert.match(financePage, /requireHQOwner\("\/finance"\)/);
  assert.match(financeUi, /Accounting/);
  assert.match(financeUi, /Cost planning/);
  assert.match(financeUi, /Actual vs forecast/);
  assert.match(financeUi, /Lock previous month/);
  assert.match(financeUi, /Receipt/);
  assert.match(financeData, /isHQDatabaseConfigured/);
  assert.match(hqAdmin, /HQ_SUPABASE_URL/);
  assert.doesNotMatch(hqAdmin, /SCURRY_SUPABASE/);
  assert.match(env, /HQ_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(migration, /hq_journal_entries/);
  assert.match(migration, /hq_block_posted_entry_mutation/);
  assert.match(migration, /hq_block_closed_period_entry/);
  assert.match(migration, /hq_reverse_journal_entry/);
  assert.match(migration, /hq_forecast_scenarios/);
  assert.match(store, /createHQAdminClient/);
  assert.doesNotMatch(store, /SCURRY_SUPABASE_SERVICE_ROLE_KEY/);
  for (const route of [journal, reversal, close, receipts]) assert.match(route, /getHQOwner/);
  assert.match(journal, /validateJournalEntry/);
  assert.match(receipts, /finance-documents/);
  assert.match(receipts, /MAX_RECEIPT_BYTES/);
});
