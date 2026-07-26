import "server-only";

type BlueskySession = {
  accessJwt: string;
  did: string;
  handle: string;
};

export type BlueskySummary = {
  status: "connected" | "not_connected" | "error";
  handle: string | null;
  lastSyncedAt: string | null;
  error?: string;
};

function getConfig() {
  const identifier = process.env.BLUESKY_IDENTIFIER?.trim();
  const appPassword = process.env.BLUESKY_APP_PASSWORD?.trim();
  if (!identifier || !appPassword) return null;

  const serviceUrl = new URL(
    process.env.BLUESKY_SERVICE_URL?.trim() || "https://bsky.social",
  );
  if (
    serviceUrl.protocol !== "https:" ||
    serviceUrl.username ||
    serviceUrl.password
  ) {
    throw new Error("The Bluesky service URL must be a secure HTTPS origin.");
  }

  return {
    identifier,
    appPassword,
    serviceUrl: serviceUrl.origin,
  };
}

async function createSession(): Promise<BlueskySession> {
  const config = getConfig();
  if (!config) throw new Error("Bluesky is not configured.");

  const response = await fetch(
    `${config.serviceUrl}/xrpc/com.atproto.server.createSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: config.identifier,
        password: config.appPassword,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Bluesky authentication failed.");

  return (await response.json()) as BlueskySession;
}

export async function readBlueskySummary(): Promise<BlueskySummary> {
  try {
    if (!getConfig()) {
      return {
        status: "not_connected",
        handle: null,
        lastSyncedAt: null,
      };
    }

    const session = await createSession();
    return {
      status: "connected",
      handle: session.handle,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      handle: null,
      lastSyncedAt: null,
      error:
        error instanceof Error ? error.message : "Bluesky connection failed.",
    };
  }
}

export async function publishBlueskyPost(text: string) {
  const normalizedText = text.trim();
  if (!normalizedText) throw new Error("Post text is required.");
  if ([...normalizedText].length > 300) {
    throw new Error("Bluesky posts must be 300 characters or fewer.");
  }

  const config = getConfig();
  if (!config) throw new Error("Bluesky is not configured.");
  const session = await createSession();
  const response = await fetch(
    `${config.serviceUrl}/xrpc/com.atproto.repo.createRecord`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text: normalizedText,
          createdAt: new Date().toISOString(),
        },
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Bluesky did not accept the post.");

  return (await response.json()) as { uri: string; cid: string };
}
