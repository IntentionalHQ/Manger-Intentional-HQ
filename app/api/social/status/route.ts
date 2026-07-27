import { getHQOwner } from "../../../chatgpt-auth";
import { readPublishStatus } from "../../../integrations/social";
import { isSocialProvider } from "../../../integrations/types";

export async function GET(request: Request) {
  const user = await getHQOwner();
  if (!user) return Response.json({ error: "Owner access required." }, { status: 403 });
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!isSocialProvider(provider) || !id) {
    return Response.json({ error: "Provider and publishing ID are required." }, { status: 400 });
  }
  try {
    return Response.json(await readPublishStatus(provider, user.email, id));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Status check failed." },
      { status: 400 },
    );
  }
}
