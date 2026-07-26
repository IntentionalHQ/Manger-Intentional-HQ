import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

test("gates the management dashboard and keeps its data server-side", async () => {
  const [page, data, schema] = await Promise.all([
    readFile(projectFile("app/page.tsx"), "utf8"),
    readFile(projectFile("app/hq-data.ts"), "utf8"),
    readFile(projectFile("db/schema.ts"), "utf8"),
  ]);

  assert.match(page, /requireChatGPTUser\("\/"\)/);
  assert.match(page, /getDashboardData\(user\.email\)/);
  assert.match(data, /owner_email/);
  assert.match(data, /readScurrySummary\(ownerEmail\)/);
  assert.match(schema, /export const connections/);
  assert.match(schema, /primaryKey\(\{ columns: \[table\.ownerEmail, table\.id\] \}\)/);
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
  assert.doesNotMatch(dashboard, /Projected MRR|Waitlist|2\.4×/i);
  assert.match(layout, /Intentional HQ — Management home base/);
  assert.ok(og.size > 100_000);
});
