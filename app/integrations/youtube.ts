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

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_URL = "https://www.googleapis.com/youtube/v3";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
];

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type YouTubeChannel = {
  id?: string;
  snippet?: { title?: string };
  statistics?: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
  };
};

function config() {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function youtubeConfigured() {
  return Boolean(config());
}

export function youtubeAuthorizationUrl(requestUrl: string, state: string) {
  const settings = config();
  if (!settings) throw new Error("YouTube credentials are not configured.");
  return `${AUTH_URL}?${new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: callbackUrl("youtube", requestUrl),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString()}`;
}

async function channel(accessToken: string): Promise<YouTubeChannel> {
  const payload = await apiJson<{ items?: YouTubeChannel[] }>(
    `${API_URL}/channels?part=snippet,statistics&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "YouTube channel",
  );
  const result = payload.items?.[0];
  if (!result) throw new Error("No YouTube channel is linked to this account.");
  return result;
}

export async function exchangeYouTubeCode(
  ownerEmail: string,
  code: string,
  requestUrl: string,
) {
  const settings = config();
  if (!settings) throw new Error("YouTube credentials are not configured.");
  const token = await apiJson<GoogleTokenResponse>(
    TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl("youtube", requestUrl),
      }),
    },
    "Google OAuth",
  );
  const account = await channel(token.access_token);
  await saveConnection(ownerEmail, "youtube", {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    externalAccountId: account.id ?? null,
    externalAccountName: account.snippet?.title ?? null,
    scopes: token.scope?.split(" ").filter(Boolean) ?? SCOPES,
  });
}

async function refreshConnection(
  ownerEmail: string,
  connection: StoredConnection,
) {
  if (
    !connection.expiresAt ||
    new Date(connection.expiresAt).getTime() > Date.now() + 5 * 60_000
  ) {
    return connection;
  }
  const settings = config();
  if (!settings || !connection.refreshToken) {
    throw new Error("Reconnect YouTube to refresh its access token.");
  }
  const token = await apiJson<GoogleTokenResponse>(
    TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
      }),
    },
    "YouTube token refresh",
  );
  const bundle: TokenBundle = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? connection.refreshToken,
    expiresAt: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    externalAccountId: connection.externalAccountId,
    externalAccountName: connection.externalAccountName,
    scopes: connection.scopes,
    metadata: connection.metadata,
  };
  await saveConnection(ownerEmail, "youtube", bundle);
  return {
    ...connection,
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken ?? null,
    expiresAt: bundle.expiresAt ?? null,
  };
}

async function activeConnection(ownerEmail: string) {
  const connection = await readConnection(ownerEmail, "youtube");
  if (!connection) throw new Error("Connect YouTube before publishing.");
  return refreshConnection(ownerEmail, connection);
}

export async function readYouTubeSummary(
  ownerEmail: string,
): Promise<SocialSummary> {
  const configured = youtubeConfigured();
  const base: SocialSummary = {
    provider: "youtube",
    status: "not_connected",
    configured,
    accountName: null,
    accountId: null,
    connectPath: "/api/integrations/youtube/connect",
    lastSyncedAt: null,
    metrics: [],
  };
  if (!configured) return { ...base, error: "Add Google OAuth credentials." };

  try {
    const stored = await readConnection(ownerEmail, "youtube");
    if (!stored) return base;
    const connection = await refreshConnection(ownerEmail, stored);
    const account = await channel(connection.accessToken);
    return {
      ...base,
      status: "connected",
      accountName: account.snippet?.title ?? connection.externalAccountName,
      accountId: account.id ?? connection.externalAccountId,
      lastSyncedAt: new Date().toISOString(),
      metrics: [
        {
          label: "Subscribers",
          value: Number(account.statistics?.subscriberCount ?? 0),
        },
        { label: "Videos", value: Number(account.statistics?.videoCount ?? 0) },
        { label: "Views", value: Number(account.statistics?.viewCount ?? 0) },
      ],
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      error: error instanceof Error ? error.message : "YouTube sync failed.",
    };
  }
}

async function remoteMedia(mediaUrl: string) {
  const media = await fetch(mediaUrl, {
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
  });
  if (!media.ok || !media.body) {
    throw new Error("The media URL could not be downloaded.");
  }
  const contentType = media.headers.get("content-type") || "video/mp4";
  if (!contentType.startsWith("video/")) {
    throw new Error("YouTube publishing requires a direct video URL.");
  }
  const contentLength = media.headers.get("content-length");
  if (!contentLength) {
    throw new Error("The media server must provide Content-Length.");
  }
  return { media, contentType, contentLength };
}

export async function publishYouTube(
  ownerEmail: string,
  request: PublishRequest,
): Promise<PublishResult> {
  const connection = await activeConnection(ownerEmail);
  const { media, contentType, contentLength } = await remoteMedia(
    request.mediaUrl,
  );
  const publishAt =
    request.scheduledAt && new Date(request.scheduledAt) > new Date()
      ? request.scheduledAt
      : undefined;
  const privacyStatus = publishAt
    ? "private"
    : request.privacy || (request.mode === "draft" ? "private" : "public");
  const metadata = {
    snippet: {
      title: request.title?.trim() || request.caption.slice(0, 100) || "Video",
      description: request.description?.trim() || request.caption,
      tags: request.tags ?? [],
    },
    status: {
      privacyStatus,
      publishAt,
      selfDeclaredMadeForKids: false,
    },
  };
  const start = await fetch(
    `${UPLOAD_URL}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": contentLength,
        "X-Upload-Content-Type": contentType,
      },
      body: JSON.stringify(metadata),
      signal: AbortSignal.timeout(20_000),
    },
  );
  const uploadUrl = start.headers.get("location");
  if (!start.ok || !uploadUrl) {
    throw new Error(`YouTube could not start the upload (${start.status}).`);
  }

  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Length": contentLength,
      "Content-Type": contentType,
    },
    body: media.body,
    signal: AbortSignal.timeout(120_000),
  });
  const result = (await uploaded.json().catch(() => null)) as {
    id?: string;
    status?: { uploadStatus?: string };
  } | null;
  if (!uploaded.ok || !result?.id) {
    throw new Error(`YouTube upload failed (${uploaded.status}).`);
  }
  if (request.thumbnailUrl) {
    const thumbnail = await fetch(request.thumbnailUrl, {
      signal: AbortSignal.timeout(20_000),
    });
    const thumbnailType = thumbnail.headers.get("content-type") || "";
    if (
      !thumbnail.ok ||
      !thumbnail.body ||
      !thumbnailType.startsWith("image/")
    ) {
      throw new Error("The YouTube thumbnail URL is not a direct image.");
    }
    const thumbnailResponse = await fetch(
      `${UPLOAD_URL}/thumbnails/set?videoId=${encodeURIComponent(result.id)}&uploadType=media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": thumbnailType,
        },
        body: thumbnail.body,
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!thumbnailResponse.ok) {
      throw new Error(`The video uploaded, but its thumbnail failed (${thumbnailResponse.status}).`);
    }
  }
  return {
    provider: "youtube",
    externalId: result.id,
    status: result.status?.uploadStatus ?? "uploaded",
    detail: publishAt ? "Scheduled on YouTube." : "Uploaded to YouTube.",
  };
}
