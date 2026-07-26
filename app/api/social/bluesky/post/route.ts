import { getChatGPTUser } from "../../../../chatgpt-auth";
import { publishBlueskyPost } from "../../../../bluesky";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { text?: string };
    const post = await publishBlueskyPost(payload.text ?? "");
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "The post could not be published.",
      },
      { status: 400 },
    );
  }
}
