import "server-only";

import { readBlueskySummary, type BlueskySummary } from "./bluesky";
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
  { id: "supabase-scurry", name: "Supabase — Scurry", kind: "data", detail: "Primary Scurry database", mark: "SB" },
  { id: "hq", name: "Intentional HQ", kind: "data", detail: "Cross-platform connection registry", mark: "HQ" },
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

export type DashboardData = {
  connections: Connection[];
  scurry: ScurrySummary;
  bluesky: BlueskySummary;
};

export async function getDashboardData(
  ownerEmail: string,
): Promise<DashboardData> {
  const [scurry, bluesky] = await Promise.all([
    readScurrySummary(ownerEmail),
    readBlueskySummary(),
  ]);
  const now = new Date().toISOString();

  return {
    connections: registry.map((connection) => {
      if (connection.id === "supabase-scurry") {
        return {
          ...connection,
          status: scurry.status,
          lastSyncedAt:
            scurry.status === "connected" ? scurry.lastSyncedAt : null,
          lastError: scurry.error ?? null,
        };
      }

      if (connection.id === "hq") {
        return {
          ...connection,
          status: "connected",
          lastSyncedAt: now,
          lastError: null,
        };
      }

      if (connection.id === "bluesky") {
        return {
          ...connection,
          detail: bluesky.handle ? `@${bluesky.handle}` : connection.detail,
          status: bluesky.status,
          lastSyncedAt: bluesky.lastSyncedAt,
          lastError: bluesky.error ?? null,
        };
      }

      return {
        ...connection,
        status: "not_connected",
        lastSyncedAt: null,
        lastError: null,
      };
    }),
    scurry,
    bluesky,
  };
}
