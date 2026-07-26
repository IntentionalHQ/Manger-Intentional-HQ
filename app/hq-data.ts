import "server-only";

import { env } from "cloudflare:workers";
import { readScurrySummary, type ScurrySummary } from "./scurry";

export type ConnStatus = "connected" | "not_connected" | "error";
export type ConnectionKind = "data" | "social" | "site";

export type Connection = {
  id: string;
  name: string;
  kind: ConnectionKind;
  detail: string;
  mark: string;
  status: ConnStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
};

const registry: Array<
  Omit<Connection, "status" | "lastSyncedAt" | "lastError">
> = [
  { id: "supabase-scurry", name: "Supabase — scurry", kind: "data", detail: "Primary Scurry database", mark: "SB" },
  { id: "supabase-hq", name: "HQ records", kind: "data", detail: "Connections stored in D1", mark: "D1" },
  { id: "instagram", name: "Instagram", kind: "social", detail: "Publishing + insights", mark: "IG" },
  { id: "linkedin", name: "LinkedIn", kind: "social", detail: "Company page", mark: "in" },
  { id: "tiktok", name: "TikTok", kind: "social", detail: "Video publishing", mark: "TT" },
  { id: "x", name: "X / Twitter", kind: "social", detail: "Posts + threads", mark: "X" },
  { id: "youtube", name: "YouTube", kind: "social", detail: "Uploads + analytics", mark: "YT" },
  { id: "threads", name: "Threads", kind: "social", detail: "Cross-post from IG", mark: "Th" },
  { id: "bluesky", name: "Bluesky", kind: "social", detail: "AT protocol posts", mark: "Bs" },
  { id: "vercel", name: "Vercel", kind: "site", detail: "Deployments + domains", mark: "▲" },
  { id: "cloudflare", name: "Cloudflare", kind: "site", detail: "Workers + Pages", mark: "CF" },
  { id: "github", name: "GitHub", kind: "site", detail: "Repos, PRs, actions", mark: "GH" },
];

function getD1() {
  if (!env.DB) throw new Error("HQ database binding is unavailable.");
  return env.DB;
}

async function seedRegistry(ownerEmail: string) {
  const db = getD1();
  await db.batch(
    registry.map((connection) =>
      db
        .prepare(
          `INSERT INTO connections
           (id, owner_email, name, kind, detail, mark, status)
           VALUES (?, ?, ?, ?, ?, ?, 'not_connected')
           ON CONFLICT(owner_email, id) DO NOTHING`,
        )
        .bind(
          connection.id,
          ownerEmail,
          connection.name,
          connection.kind,
          connection.detail,
          connection.mark,
        ),
    ),
  );
}

async function updateConnection(
  ownerEmail: string,
  id: string,
  status: ConnStatus,
  lastSyncedAt: string | null,
  lastError: string | null,
) {
  await getD1()
    .prepare(
      `UPDATE connections
       SET status = ?, last_synced_at = ?, last_error = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE owner_email = ? AND id = ?`,
    )
    .bind(status, lastSyncedAt, lastError, ownerEmail, id)
    .run();
}

async function listConnections(ownerEmail: string): Promise<Connection[]> {
  const result = await getD1()
    .prepare(
      `SELECT id, name, kind, detail, mark, status,
              last_synced_at AS lastSyncedAt,
              last_error AS lastError
       FROM connections
       WHERE owner_email = ?
       ORDER BY CASE kind WHEN 'data' THEN 1 WHEN 'social' THEN 2 ELSE 3 END,
                name`,
    )
    .bind(ownerEmail)
    .all<Connection>();
  return result.results;
}

export type DashboardData = {
  connections: Connection[];
  scurry: ScurrySummary;
};

export async function getDashboardData(
  ownerEmail: string,
): Promise<DashboardData> {
  await seedRegistry(ownerEmail);
  await updateConnection(
    ownerEmail,
    "supabase-hq",
    "connected",
    new Date().toISOString(),
    null,
  );

  const scurry = await readScurrySummary(ownerEmail);
  await updateConnection(
    ownerEmail,
    "supabase-scurry",
    scurry.status,
    scurry.status === "connected" ? scurry.lastSyncedAt : null,
    scurry.error ?? null,
  );

  return {
    connections: await listConnections(ownerEmail),
    scurry,
  };
}
