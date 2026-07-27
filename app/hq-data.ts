import "server-only";

import {
  readScurryBusinessSummary,
  readScurrySummary,
  type ScurryBusinessSummary,
  type ScurrySummary,
} from "./scurry";
import { readVercelSummary, type VercelSummary } from "./vercel";

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
  { id: "instagram", name: "Instagram", kind: "social", detail: "Requires Meta OAuth and app review", mark: "IG" },
  { id: "tiktok", name: "TikTok", kind: "social", detail: "Requires Content Posting API review", mark: "TT" },
  { id: "youtube", name: "YouTube", kind: "social", detail: "Requires Google OAuth credentials", mark: "YT" },
  { id: "vercel", name: "Vercel", kind: "site", detail: "Requires a scoped Vercel token", mark: "▲" },
  { id: "cloudflare", name: "Cloudflare", kind: "site", detail: "Requires a scoped Cloudflare API token", mark: "CF" },
  { id: "github", name: "GitHub", kind: "site", detail: "Requires a GitHub App installation", mark: "GH" },
];

export type DashboardData = {
  connections: Connection[];
  scurry: ScurrySummary;
  scurryBusiness: ScurryBusinessSummary;
  vercel: VercelSummary;
};

export async function getDashboardData(
  ownerEmail: string,
): Promise<DashboardData> {
  const [scurry, scurryBusiness, vercel] = await Promise.all([
    readScurrySummary(ownerEmail),
    readScurryBusinessSummary(),
    readVercelSummary(),
  ]);
  const now = new Date().toISOString();

  return {
    connections: registry.map((connection) => {
      if (connection.id === "supabase-scurry") {
        return {
          ...connection,
          status: scurryBusiness.status,
          lastSyncedAt:
            scurryBusiness.status === "connected"
              ? scurryBusiness.lastCheckedAt
              : null,
          lastError: scurryBusiness.error ?? null,
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

      if (connection.id === "vercel") {
        const latest = vercel.deployments[0];
        return {
          ...connection,
          detail: latest
            ? `Latest deployment: ${latest.status}`
            : connection.detail,
          status: vercel.status,
          lastSyncedAt:
            vercel.status === "connected" ? vercel.lastCheckedAt : null,
          lastError: vercel.error ?? null,
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
    scurryBusiness,
    vercel,
  };
}
