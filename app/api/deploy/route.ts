import { getHQOwner } from "../../chatgpt-auth";
import { recordActivity } from "../../integrations/store";

type HookMap = Record<string, string>;

function hooksFor(provider: "vercel" | "cloudflare"): HookMap {
  const source =
    provider === "vercel"
      ? process.env.HQ_VERCEL_DEPLOY_HOOKS_JSON
      : process.env.HQ_CLOUDFLARE_DEPLOY_HOOKS_JSON;
  if (!source?.trim()) return {};
  try {
    const parsed = JSON.parse(source) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as HookMap)
      : {};
  } catch {
    throw new Error(`${provider} deploy hooks JSON is invalid.`);
  }
}

function allowedHook(provider: "vercel" | "cloudflare", value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") return false;
  return provider === "vercel"
    ? url.hostname === "api.vercel.com" &&
        url.pathname.startsWith("/v1/integrations/deploy/")
    : url.hostname === "api.cloudflare.com" &&
        url.pathname.includes("/pages/webhooks/deploy_hooks/");
}

export async function POST(request: Request) {
  const user = await getHQOwner();
  if (!user) return Response.json({ error: "Owner access required." }, { status: 403 });
  try {
    const payload = (await request.json()) as {
      provider?: string;
      project?: string;
    };
    if (payload.provider !== "vercel" && payload.provider !== "cloudflare") {
      throw new Error("Choose Vercel or Cloudflare.");
    }
    const project = payload.project?.trim();
    if (!project) throw new Error("Project name is required.");
    const hook = hooksFor(payload.provider)[project];
    if (!hook) {
      throw new Error(`No ${payload.provider} deploy hook is configured for ${project}.`);
    }
    if (!allowedHook(payload.provider, hook)) {
      throw new Error("The configured deploy hook host is not allowed.");
    }
    const response = await fetch(hook, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(`${payload.provider} deploy hook returned ${response.status}.`);
    }
    await recordActivity({
      ownerEmail: user.email,
      provider: payload.provider,
      kind: "deployment",
      title: `${project} deployment triggered`,
    });
    return Response.json({ ok: true, provider: payload.provider, project });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Deployment trigger failed." },
      { status: 400 },
    );
  }
}
