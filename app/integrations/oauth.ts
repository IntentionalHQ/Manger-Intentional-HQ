import "server-only";

import { NextResponse } from "next/server";
import type { SocialProvider } from "./types";

const COOKIE_PREFIX = "hq_oauth_";

export function callbackUrl(provider: SocialProvider, requestUrl: string) {
  const variable =
    provider === "tiktok"
      ? process.env.TIKTOK_REDIRECT_URI
      : provider === "youtube"
        ? process.env.YOUTUBE_REDIRECT_URI
        : process.env.INSTAGRAM_REDIRECT_URI;
  return (
    variable?.trim() ||
    `${new URL(requestUrl).origin}/api/integrations/${provider}/callback`
  );
}

export function oauthState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function oauthRedirect(
  provider: SocialProvider,
  authorizationUrl: string,
  state: string,
) {
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(`${COOKIE_PREFIX}${provider}`, state, {
    httpOnly: true,
    secure: authorizationUrl.startsWith("https://"),
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}

export function validOauthState(
  provider: SocialProvider,
  cookieValue: string | undefined,
  returnedState: string | null,
): boolean {
  if (!cookieValue || !returnedState || cookieValue.length !== returnedState.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < cookieValue.length; index += 1) {
    difference |= cookieValue.charCodeAt(index) ^ returnedState.charCodeAt(index);
  }
  return difference === 0;
}

export function oauthCookieName(provider: SocialProvider) {
  return `${COOKIE_PREFIX}${provider}`;
}

export function dashboardRedirect(
  requestUrl: string,
  provider: SocialProvider,
  state: "connected" | "error",
  message?: string,
) {
  const target = new URL("/", requestUrl);
  target.searchParams.set("integration", provider);
  target.searchParams.set("state", state);
  if (message) target.searchParams.set("message", message.slice(0, 180));
  const response = NextResponse.redirect(target);
  response.cookies.delete(oauthCookieName(provider));
  return response;
}

export async function apiJson<T>(
  url: string,
  init: RequestInit,
  label: string,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: unknown; error_description?: string })
    | null;
  if (!response.ok || !payload) {
    const description =
      payload && typeof payload.error_description === "string"
        ? payload.error_description
        : `${label} returned ${response.status}.`;
    throw new Error(description);
  }
  return payload;
}
