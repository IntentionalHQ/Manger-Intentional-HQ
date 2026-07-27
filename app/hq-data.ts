import "server-only";

import { readCloudflareSummary, type CloudflareSummary } from "./cloudflare";
import { readGitHubSummary, type GitHubSummary } from "./github";
import { readActivity, readSavedQueries } from "./integrations/store";
import { readSocialSummaries } from "./integrations/social";
import type { SocialSummary } from "./integrations/types";
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
  actionHref?: string;
  actionLabel?: string;
};

const registry: Array<
  Omit<Connection, "status" | "lastSyncedAt" | "lastError">
> = [
  { id: "supabase-scurry", name: "Supabase — Scurry", kind: "data", detail: "Primary Scurry database", mark: "SB" },
  { id: "hq", name: "Intentional HQ", kind: "data", detail: "Cross-platform connection registry", mark: "HQ" },
  { id: "tiktok", name: "TikTok", kind: "social", detail: "Requires Content Posting API review", mark: "TT" },
  { id: "youtube", name: "YouTube", kind: "social", detail: "Requires Google OAuth credentials", mark: "YT" },
  { id: "instagram", name: "Instagram", kind: "social", detail: "Requires Meta OAuth and app review", mark: "IG" },
  { id: "vercel", name: "Vercel", kind: "site", detail: "Requires a scoped Vercel token", mark: "▲" },
  { id: "cloudflare", name: "Cloudflare", kind: "site", detail: "Requires a scoped Cloudflare API token", mark: "CF" },
  { id: "github", name: "GitHub", kind: "site", detail: "Requires a GitHub App installation", mark: "GH" },
];

export type DashboardData = {
  connections: Connection[];
  scurry: ScurrySummary;
  scurryBusiness: ScurryBusinessSummary;
  social: SocialSummary[];
  vercel: VercelSummary;
  github: GitHubSummary;
  cloudflare: CloudflareSummary;
  activity: Awaited<ReturnType<typeof readActivity>>;
  savedQueries: Awaited<ReturnType<typeof readSavedQueries>>;
};

export async function getDashboardData(
  ownerEmail: string,
): Promise<DashboardData> {
  const [
    scurry,
    scurryBusiness,
    social,
    vercel,
    github,
    cloudflare,
    activity,
    savedQueries,
  ] = await Promise.all([
    readScurrySummary(ownerEmail),
    readScurryBusinessSummary(),
    readSocialSummaries(ownerEmail),
    readVercelSummary(),
    readGitHubSummary(),
    readCloudflareSummary(),
    readActivity(ownerEmail),
    readSavedQueries(ownerEmail),
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

      const socialConnection = social.find(
        (summary) => summary.provider === connection.id,
      );
      if (socialConnection) {
        return {
          ...connection,
          detail:
            socialConnection.accountName ??
            socialConnection.error ??
            connection.detail,
          status: socialConnection.status,
          lastSyncedAt: socialConnection.lastSyncedAt,
          lastError: socialConnection.error ?? null,
          actionHref:
            socialConnection.status === "connected"
              ? undefined
              : socialConnection.configured
                ? socialConnection.connectPath
                : undefined,
          actionLabel:
            socialConnection.status === "connected" ? undefined : "Connect",
        };
      }

      if (connection.id === "vercel") {
        const latest = vercel.deployments[0];
        return {
          ...connection,
          detail: vercel.projects.length
            ? `${vercel.projects.length} projects · latest ${latest?.status ?? "unknown"}`
            : connection.detail,
          status: vercel.status,
          lastSyncedAt:
            vercel.status === "connected" ? vercel.lastCheckedAt : null,
          lastError: vercel.error ?? null,
        };
      }

      if (connection.id === "github") {
        return {
          ...connection,
          detail: github.repositories.length
            ? `${github.repositories.length} repositories`
            : github.error ?? connection.detail,
          status: github.status,
          lastSyncedAt:
            github.status === "connected" ? github.lastCheckedAt : null,
          lastError: github.error ?? null,
        };
      }

      if (connection.id === "cloudflare") {
        return {
          ...connection,
          detail: cloudflare.projects.length
            ? `${cloudflare.projects.length} projects`
            : cloudflare.error ?? connection.detail,
          status: cloudflare.status,
          lastSyncedAt:
            cloudflare.status === "connected"
              ? cloudflare.lastCheckedAt
              : null,
          lastError: cloudflare.error ?? null,
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
    social,
    vercel,
    github,
    cloudflare,
    activity,
    savedQueries,
  };
}
