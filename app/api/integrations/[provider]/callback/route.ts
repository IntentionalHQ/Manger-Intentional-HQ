import type { NextRequest } from "next/server";
import { getHQOwner } from "../../../../chatgpt-auth";
import {
  exchangeAuthorizationCode,
} from "../../../../integrations/social";
import {
  dashboardRedirect,
  oauthCookieName,
  validOauthState,
} from "../../../../integrations/oauth";
import { recordActivity } from "../../../../integrations/store";
import { isSocialProvider } from "../../../../integrations/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!isSocialProvider(provider)) {
    return Response.json({ error: "Unknown integration." }, { status: 404 });
  }
  const user = await getHQOwner();
  if (!user) return dashboardRedirect(request.url, provider, "error", "Owner access required.");

  const error = request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");
  if (error) return dashboardRedirect(request.url, provider, "error", error);

  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(oauthCookieName(provider))?.value;
  if (!validOauthState(provider, cookieState, state)) {
    return dashboardRedirect(request.url, provider, "error", "OAuth state did not match.");
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return dashboardRedirect(request.url, provider, "error", "Authorization code missing.");

  try {
    await exchangeAuthorizationCode(provider, user.email, code, request.url);
    await recordActivity({
      ownerEmail: user.email,
      provider,
      kind: "connection",
      title: `${provider} connected`,
    });
    return dashboardRedirect(request.url, provider, "connected");
  } catch (cause) {
    return dashboardRedirect(
      request.url,
      provider,
      "error",
      cause instanceof Error ? cause.message : "The connection could not be saved.",
    );
  }
}
