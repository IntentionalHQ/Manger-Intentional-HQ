import { getHQOwner } from "../../../chatgpt-auth";
import { publishToProvider } from "../../../integrations/social";
import {
  recordActivity,
  schedulePost,
} from "../../../integrations/store";
import {
  isSocialProvider,
  type PublishRequest,
  type SocialProvider,
} from "../../../integrations/types";

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const user = await getHQOwner();
  if (!user) return Response.json({ error: "Owner access required." }, { status: 403 });

  try {
    const payload = (await request.json()) as PublishRequest & {
      targets?: string[];
    };
    const targets = (payload.targets ?? []).filter(isSocialProvider) as SocialProvider[];
    if (!targets.length) throw new Error("Choose at least one social channel.");
    if (!payload.caption?.trim()) throw new Error("Caption is required.");
    if (!validHttpUrl(payload.mediaUrl)) {
      throw new Error("A direct HTTPS media URL is required.");
    }
    const publishRequest: PublishRequest = {
      ...payload,
      caption: payload.caption.trim(),
      mediaUrl: payload.mediaUrl.trim(),
      mode: payload.mode === "draft" ? "draft" : "direct",
    };

    if (
      publishRequest.scheduledAt &&
      new Date(publishRequest.scheduledAt).getTime() > Date.now() + 60_000
    ) {
      const id = await schedulePost(user.email, targets, publishRequest);
      await recordActivity({
        ownerEmail: user.email,
        provider: targets.join(","),
        kind: "scheduled_post",
        title: "Social post scheduled",
        externalId: id,
      });
      return Response.json({ scheduled: true, id }, { status: 202 });
    }

    const settled = await Promise.allSettled(
      targets.map((provider) =>
        publishToProvider(provider, user.email, publishRequest),
      ),
    );
    const results = settled.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : {
            provider: targets[index],
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Publishing failed.",
          },
    );
    for (const result of results) {
      await recordActivity({
        ownerEmail: user.email,
        provider: result.provider,
        kind: "publish",
        title:
          "error" in result
            ? `${result.provider} publishing failed`
            : `${result.provider} post submitted`,
        detail: "error" in result ? result.error : result.detail,
        externalId: "externalId" in result ? result.externalId : undefined,
      });
    }
    return Response.json({ results }, { status: 207 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Publishing failed." },
      { status: 400 },
    );
  }
}
