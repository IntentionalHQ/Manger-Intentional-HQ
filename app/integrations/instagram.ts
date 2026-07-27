import "server-only";

import { apiJson, callbackUrl } from "./oauth";
import { readConnection, saveConnection } from "./store";
import type {
  PublishRequest,
  PublishResult,
  SocialSummary,
} from "./types";

const AUTH_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_TOKEN_URL = "https://graph.instagram.com/access_token";
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];

type InstagramTokenResponse = {
  access_token: string;
  user_id?: number | string;
  expires_in?: number;
};

type InstagramProfile = {
  id?: string;
  user_id?: string;
  username?: string;
  account_type?: string;
  media_count?: number;
};

function config() {
  const clientId = process.env.INSTAGRAM_CLIENT_ID?.trim();
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function graphUrl(path: string) {
  const base = (
    process.env.INSTAGRAM_GRAPH_BASE_URL?.trim() ||
    "https://graph.instagram.com"
  ).replace(/\/+$/, "");
  const version = process.env.INSTAGRAM_GRAPH_VERSION?.trim();
  return `${base}${version ? `/${version}` : ""}${path}`;
}

export function instagramConfigured() {
  return Boolean(config());
}

export function instagramAuthorizationUrl(requestUrl: string, state: string) {
  const settings = config();
  if (!settings) throw new Error("Instagram credentials are not configured.");
  return `${AUTH_URL}?${new URLSearchParams({
    enable_fb_login: "0",
    force_authentication: "1",
    client_id: settings.clientId,
    redirect_uri: callbackUrl("instagram", requestUrl),
    response_type: "code",
    scope: SCOPES.join(","),
    state,
  }).toString()}`;
}

async function profile(accessToken: string): Promise<InstagramProfile> {
  return apiJson<InstagramProfile>(
    `${graphUrl("/me")}?${new URLSearchParams({
      fields: "id,user_id,username,account_type,media_count",
      access_token: accessToken,
    }).toString()}`,
    {},
    "Instagram profile",
  );
}

export async function exchangeInstagramCode(
  ownerEmail: string,
  code: string,
  requestUrl: string,
) {
  const settings = config();
  if (!settings) throw new Error("Instagram credentials are not configured.");
  const shortToken = await apiJson<InstagramTokenResponse>(
    TOKEN_URL,
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl("instagram", requestUrl),
        code,
      }),
    },
    "Instagram OAuth",
  );
  const longToken = await apiJson<InstagramTokenResponse>(
    `${LONG_LIVED_TOKEN_URL}?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: settings.clientSecret,
      access_token: shortToken.access_token,
    }).toString()}`,
    {},
    "Instagram long-lived token",
  );
  const account = await profile(longToken.access_token);
  await saveConnection(ownerEmail, "instagram", {
    accessToken: longToken.access_token,
    expiresAt: longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000).toISOString()
      : null,
    externalAccountId:
      account.user_id ?? account.id ?? String(shortToken.user_id ?? ""),
    externalAccountName: account.username ?? null,
    scopes: SCOPES,
    metadata: { accountType: account.account_type ?? null },
  });
}

async function activeConnection(ownerEmail: string) {
  const connection = await readConnection(ownerEmail, "instagram");
  if (!connection) throw new Error("Connect Instagram before publishing.");
  if (
    connection.expiresAt &&
    new Date(connection.expiresAt).getTime() <= Date.now()
  ) {
    throw new Error("Reconnect Instagram because its token expired.");
  }
  return connection;
}

async function containerStatus(accessToken: string, containerId: string) {
  return apiJson<{ status_code?: string; status?: string }>(
    `${graphUrl(`/${encodeURIComponent(containerId)}`)}?${new URLSearchParams({
      fields: "status_code,status",
      access_token: accessToken,
    }).toString()}`,
    {},
    "Instagram container status",
  );
}

async function waitForContainer(accessToken: string, containerId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const status = await containerStatus(accessToken, containerId);
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(status.status || "Instagram could not process the media.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(
    "Instagram is still processing the media. Check the container status and publish again.",
  );
}

export async function readInstagramSummary(
  ownerEmail: string,
): Promise<SocialSummary> {
  const configured = instagramConfigured();
  const base: SocialSummary = {
    provider: "instagram",
    status: "not_connected",
    configured,
    accountName: null,
    accountId: null,
    connectPath: "/api/integrations/instagram/connect",
    lastSyncedAt: null,
    metrics: [],
  };
  if (!configured) return { ...base, error: "Add Meta app credentials." };

  try {
    const connection = await readConnection(ownerEmail, "instagram");
    if (!connection) return base;
    const account = await profile(connection.accessToken);
    const media = await apiJson<{
      data?: Array<{ like_count?: number; comments_count?: number }>;
    }>(
      `${graphUrl("/me/media")}?${new URLSearchParams({
        fields: "id,like_count,comments_count,timestamp",
        limit: "25",
        access_token: connection.accessToken,
      }).toString()}`,
      {},
      "Instagram media",
    );
    const recent = media.data ?? [];
    return {
      ...base,
      status: "connected",
      accountName: account.username ?? connection.externalAccountName,
      accountId: account.user_id ?? account.id ?? connection.externalAccountId,
      lastSyncedAt: new Date().toISOString(),
      metrics: [
        { label: "Media", value: Number(account.media_count ?? 0) },
        {
          label: "Recent likes",
          value: recent.reduce((sum, item) => sum + (item.like_count ?? 0), 0),
        },
        {
          label: "Recent comments",
          value: recent.reduce(
            (sum, item) => sum + (item.comments_count ?? 0),
            0,
          ),
        },
      ],
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      error: error instanceof Error ? error.message : "Instagram sync failed.",
    };
  }
}

export async function publishInstagram(
  ownerEmail: string,
  request: PublishRequest,
): Promise<PublishResult> {
  const connection = await activeConnection(ownerEmail);
  const accountId = connection.externalAccountId;
  if (!accountId) throw new Error("Instagram account identity is unavailable.");
  const isImage = request.mediaType === "image";
  const containerBody = new URLSearchParams({
    caption: request.caption,
    access_token: connection.accessToken,
  });
  if (isImage) {
    containerBody.set("image_url", request.mediaUrl);
  } else {
    containerBody.set("media_type", "REELS");
    containerBody.set("video_url", request.mediaUrl);
    containerBody.set("share_to_feed", request.shareToFeed === false ? "false" : "true");
  }
  const container = await apiJson<{ id?: string }>(
    graphUrl(`/${encodeURIComponent(accountId)}/media`),
    { method: "POST", body: containerBody },
    "Instagram media container",
  );
  if (!container.id) throw new Error("Instagram did not create a media container.");

  if (request.mode === "draft") {
    return {
      provider: "instagram",
      externalId: container.id,
      status: "container_created",
      detail: "Instagram container created but not published.",
    };
  }

  await waitForContainer(connection.accessToken, container.id);
  const published = await apiJson<{ id?: string }>(
    graphUrl(`/${encodeURIComponent(accountId)}/media_publish`),
    {
      method: "POST",
      body: new URLSearchParams({
        creation_id: container.id,
        access_token: connection.accessToken,
      }),
    },
    "Instagram publishing",
  );
  if (!published.id) throw new Error("Instagram did not publish the media.");
  return {
    provider: "instagram",
    externalId: published.id,
    status: "published",
    detail: isImage ? "Feed post published." : "Reel published.",
  };
}

export async function readInstagramContainerStatus(
  ownerEmail: string,
  containerId: string,
) {
  const connection = await activeConnection(ownerEmail);
  return containerStatus(connection.accessToken, containerId);
}
