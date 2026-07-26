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

  assert.match(page, /requireChatGPTUser\("\/"\)/);
  assert.match(page, /getDashboardData\(user\.email\)/);
  assert.match(data, /readScurrySummary\(ownerEmail\)/);
  assert.doesNotMatch(data, /cloudflare:workers|env\.DB/);
  assert.match(auth, /oai-authenticated-user-email/);
  assert.match(auth, /supabase\.auth\.getUser\(\)/);
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
  assert.doesNotMatch(scurry, /NEXT_PUBLIC_SUPABASE/);
  assert.match(route, /getChatGPTUser\(\)/);
  assert.match(route, /Authentication required/);
  assert.match(route, /addScurryTask\(user\.email/);
});

test("ships the five work surfaces without invented launch metrics", async () => {
  const [dashboard, layout, og] = await Promise.all([
    readFile(projectFile("app/dashboard.tsx"), "utf8"),
    readFile(projectFile("app/layout.tsx"), "utf8"),
    stat(projectFile("public/og.png")),
  ]);

  for (const label of ["Overview", "Data", "Social", "Sites", "Actions"]) {
    assert.match(dashboard, new RegExp(`label: "${label}"`));
  }
  assert.match(dashboard, /<h2>Add a task<\/h2>/);
  assert.match(dashboard, /Add to Scurry/);
  assert.doesNotMatch(dashboard, /Projected MRR|Waitlist/i);
  assert.match(layout, /Intentional HQ .* Management home base/);
  assert.ok(og.size > 100_000);
});

test("provides a Supabase magic-link flow for Vercel", async () => {
  const [login, magicLink, callback] = await Promise.all([
    readFile(projectFile("app/login/login-form.tsx"), "utf8"),
    readFile(projectFile("app/api/auth/magic-link/route.ts"), "utf8"),
    readFile(projectFile("app/auth/callback/route.ts"), "utf8"),
  ]);

  assert.match(login, /Email me a sign-in link/);
  assert.match(magicLink, /signInWithOtp/);
  assert.match(magicLink, /emailRedirectTo/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /safeReturnPath/);
});
