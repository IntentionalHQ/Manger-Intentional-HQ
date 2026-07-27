import { getHQOwner } from "../../../../chatgpt-auth";
import { publishToProvider } from "../../../../integrations/social";
import {
  finishScheduledPost,
  readDuePosts,
  recordActivity,
} from "../../../../integrations/store";

async function authorized(request: Request) {
  const configured = (
    process.env.HQ_CRON_SECRET ?? process.env.CRON_SECRET
  )?.trim();
  if (
    configured &&
    request.headers.get("authorization") === `Bearer ${configured}`
  ) {
    return true;
  }
  return Boolean(await getHQOwner());
}

export async function POST(request: Request) {
  if (!(await authorized(request))) {
    return Response.json({ error: "Owner or cron authorization required." }, { status: 403 });
  }
  try {
    const due = await readDuePosts();
    const processed = [];
    for (const post of due) {
      const settled = await Promise.allSettled(
        post.targets.map((provider) =>
          publishToProvider(provider, post.owner_email, {
            ...post.payload,
            scheduledAt: null,
          }),
        ),
      );
      const results = settled.map((result, index) =>
        result.status === "fulfilled"
          ? result.value
          : {
              provider: post.targets[index],
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : "Publishing failed.",
            },
      );
      const failed = results.some((result) => "error" in result);
      await finishScheduledPost(post.id, failed ? "failed" : "published", results);
      await recordActivity({
        ownerEmail: post.owner_email,
        provider: post.targets.join(","),
        kind: "scheduled_post",
        title: failed ? "Scheduled post needs attention" : "Scheduled post published",
        externalId: post.id,
      });
      processed.push({ id: post.id, status: failed ? "failed" : "published" });
    }
    return Response.json({ processed });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Scheduled run failed." },
      { status: 500 },
    );
  }
}
