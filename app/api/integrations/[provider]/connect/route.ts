import type { NextRequest } from "next/server";
import { getHQOwner } from "../../../../chatgpt-auth";
import {
  authorizationUrl,
} from "../../../../integrations/social";
import {
  oauthRedirect,
  oauthState,
} from "../../../../integrations/oauth";
import { isSocialProvider } from "../../../../integrations/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const user = await getHQOwner();
  if (!user) return Response.json({ error: "Owner access required." }, { status: 403 });
  const { provider } = await context.params;
  if (!isSocialProvider(provider)) {
    return Response.json({ error: "Unknown integration." }, { status: 404 });
  }

  try {
    const state = oauthState();
    return oauthRedirect(
      provider,
      authorizationUrl(provider, request.url, state),
      state,
    );
  } catch (error) {
    const target = new URL("/", request.url);
    target.searchParams.set("integration", provider);
    target.searchParams.set("state", "error");
    target.searchParams.set(
      "message",
      error instanceof Error ? error.message : "Connection setup failed.",
    );
    return Response.redirect(target);
  }
}
