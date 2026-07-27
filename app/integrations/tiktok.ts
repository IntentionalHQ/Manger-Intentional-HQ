import "server-only";

import { apiJson, callbackUrl } from "./oauth";
import { readConnection, saveConnection } from "./store";
import type {
  PublishRequest,
  PublishResult,
  SocialSummary,
  StoredConnection,
  TokenBundle,
} from "./types";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const API_URL = "https://open.tiktokapis.com/v2";
const SCOPES = [
  "user.info.basic",
  "user.info.stats",
  "video.list",
  "video.upload",
  "video.publish",
];

type TikTokTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
};

function config() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  return clientKey && clientSecret ? { clientKey, clientSecret } : null;
}

export function tiktokConfigured() {
  return Boolean(config());
}

export function tiktokAuthorizationUrl(requestUrl: string, state: string) {
  const settings = config();
  if (!settings) throw new Error("TikTok credentials are not configured.");
  const query = new URLSearchParams({
    client_key: settings.clientKey,
    response_type: "code",
    scope: SCOPES.join(","),
    redirect_uri: callbackUrl("tiktok", requestUrl),
    state,
  });
  return `${AUTH_URL}?${query.toString()}`;
}

export async function exchangeTikTokCode(
  ownerEmail: string,
  code: string,
  requestUrl: string,
) {
  const settings = config();
  if (!settings) throw new Error("TikTok credentials are not configured.");
  const body = new URLSearchParams({
    client_key: settings.clientKey,
    client_secret: settings.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl("tiktok", requestUrl),
  });
  const token = await apiJson<TikTokTokenResponse>(
    `${API_URL}/oauth/token/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    "TikTok OAuth",
  );
  const profile = await tiktokProfile(token.access_token);
  await saveConnection(ownerEmail, "tiktok", {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    externalAccountId: token.open_id,
    externalAccountName:
      typeof profile.display_name === "string" ? profile.display_name : null,
    scopes: token.scope.split(",").filter(Boolean),
    metadata: { refreshExpiresIn: token.refresh_expires_in },
  });
}

async function tiktokProfile(accessToken: string) {
  const fields = [
    "open_id",
    "display_name",
    "avatar_url",
    "follower_count",
    "following_count",
    "likes_count",
    "video_count",
  ].join(",");
  const payload = await apiJson<{
    data?: { user?: Record<string, string | number | undefined> };
    error?: { code?: string; message?: string };
  }>(
    `${API_URL}/user/info/?fields=${encodeURIComponent(fields)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "TikTok profile",
  );
  if (payload.error?.code && payload.error.code !== "ok") {
    throw new Error(payload.error.message || "TikTok profile access failed.");
  }
  return payload.data?.user ?? {};
}

async function tiktokVideos(accessToken: string) {
  const fields = [
    "id",
    "title",
    "view_count",
    "like_count",
    "comment_count",
    "share_count",
  ].join(",");
  const payload = await apiJson<{
    data?: {
      videos?: Array<{
        view_count?: number;
        like_count?: number;
        comment_count?: number;
        share_count?: number;
      }>;
    };
    error?: { code?: string; message?: string };
  }>(
    `${API_URL}/video/list/?fields=${encodeURIComponent(fields)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_count: 20 }),
    },
    "TikTok videos",
  );
  if (payload.error?.code && payload.error.code !== "ok") {
    throw new Error(payload.error.message || "TikTok videos are unavailable.");
  }
  return payload.data?.videos ?? [];
}

async function refreshConnection(
  ownerEmail: string,
  connection: StoredConnection,
) {
  if (
    !connection.refreshToken ||
    !connection.expiresAt ||
    new Date(connection.expiresAt).getTime() > Date.now() + 5 * 60_000
  ) {
    return connection;
  }
  const settings = config();
  if (!settings) return connection;
  const token = await apiJson<TikTokTokenResponse>(
    `${API_URL}/oauth/token/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: settings.clientKey,
        client_secret: settings.clientSecret,
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
      }),
    },
    "TikTok token refresh",
  );
  const bundle: TokenBundle = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    externalAccountId: token.open_id,
    externalAccountName: connection.externalAccountName,
    scopes: token.scope.split(",").filter(Boolean),
    metadata: connection.metadata,
  };
  await saveConnection(ownerEmail, "tiktok", bundle);
  return {
    ...connection,
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken ?? null,
    expiresAt: bundle.expiresAt ?? null,
  };
}

async function activeConnection(ownerEmail: string) {
  const connection = await readConnection(ownerEmail, "tiktok");
  if (!connection) throw new Error("Connect TikTok before publishing.");
  return refreshConnection(ownerEmail, connection);
}

export async function readTikTokSummary(
  ownerEmail: string,
): Promise<SocialSummary> {
  const configured = tiktokConfigured();
  const base: SocialSummary = {
    provider: "tiktok",
    status: "not_connected",
    configured,
    accountName: null,
    accountId: null,
    connectPath: "/api/integrations/tiktok/connect",
    lastSyncedAt: null,
    metrics: [],
  };
  if (!configured) return { ...base, error: "Add the TikTok app credentials." };

  try {
    const stored = await readConnection(ownerEmail, "tiktok");
    if (!stored) return base;
    const connection = await refreshConnection(ownerEmail, stored);
    const [profile, videos] = await Promise.all([
      tiktokProfile(connection.accessToken),
      tiktokVideos(connection.accessToken),
    ]);
    return {
      ...base,
      status: "connected",
      accountName:
        typeof profile.display_name === "string"
          ? profile.display_name
          : connection.externalAccountName,
      accountId: connection.externalAccountId,
      lastSyncedAt: new Date().toISOString(),
      metrics: [
        { label: "Followers", value: Number(profile.follower_count ?? 0) },
        { label: "Videos", value: Number(profile.video_count ?? 0) },
        {
          label: "Recent views",
          value: videos.reduce(
            (sum, video) => sum + Number(video.view_count ?? 0),
            0,
          ),
        },
        {
          label: "Recent likes",
          value: videos.reduce(
            (sum, video) => sum + Number(video.like_count ?? 0),
            0,
          ),
        },
      ],
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      error: error instanceof Error ? error.message : "TikTok sync failed.",
    };
  }
}

export async function readTikTokCreatorInfo(ownerEmail: string) {
  const connection = await activeConnection(ownerEmail);
  const payload = await apiJson<{
    data?: {
      creator_username?: string;
      creator_nickname?: string;
      privacy_level_options?: string[];
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
      max_video_post_duration_sec?: number;
    };
    error?: { code?: string; message?: string };
  }>(
    `${API_URL}/post/publish/creator_info/query/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: "{}",
    },
    "TikTok creator info",
  );
  if (payload.error?.code && payload.error.code !== "ok") {
    throw new Error(payload.error.message || "TikTok creator is unavailable.");
  }
  return payload.data ?? {};
}

export async function publishTikTok(
  ownerEmail: string,
  request: PublishRequest,
): Promise<PublishResult> {
  const connection = await activeConnection(ownerEmail);
  const direct = request.mode === "direct";
  if (direct) await readTikTokCreatorInfo(ownerEmail);

  const endpoint = direct
    ? "/post/publish/video/init/"
    : "/post/publish/inbox/video/init/";
  const body = direct
    ? {
        post_info: {
          title: request.caption,
          privacy_level: request.privacy || "SELF_ONLY",
          disable_comment: Boolean(request.disableComments),
          disable_duet: Boolean(request.disableDuet),
          disable_stitch: Boolean(request.disableStitch),
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: request.mediaUrl,
        },
      }
    : {
        source_info: {
          source: "PULL_FROM_URL",
          video_url: request.mediaUrl,
        },
      };
  const payload = await apiJson<{
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  }>(
    `${API_URL}${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    },
    "TikTok publishing",
  );
  if (payload.error?.code && payload.error.code !== "ok") {
    throw new Error(payload.error.message || "TikTok rejected the post.");
  }
  const publishId = payload.data?.publish_id;
  if (!publishId) throw new Error("TikTok did not return a publishing ID.");
  return {
    provider: "tiktok",
    externalId: publishId,
    status: "processing",
    detail: direct ? "Direct Post submitted." : "Draft sent to TikTok inbox.",
  };
}

export async function readTikTokPublishStatus(
  ownerEmail: string,
  publishId: string,
) {
  const connection = await activeConnection(ownerEmail);
  return apiJson<{
    data?: Record<string, unknown>;
    error?: { code?: string; message?: string };
  }>(
    `${API_URL}/post/publish/status/fetch/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: publishId }),
    },
    "TikTok publishing status",
  );
}
