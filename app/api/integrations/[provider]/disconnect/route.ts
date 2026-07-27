import { getHQOwner } from "../../../../chatgpt-auth";
import { deleteConnection, recordActivity } from "../../../../integrations/store";
import { isSocialProvider } from "../../../../integrations/types";

export async function POST(
  _request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const user = await getHQOwner();
  if (!user) return Response.json({ error: "Owner access required." }, { status: 403 });
  const { provider } = await context.params;
  if (!isSocialProvider(provider)) {
    return Response.json({ error: "Unknown integration." }, { status: 404 });
  }
  try {
    await deleteConnection(user.email, provider);
    await recordActivity({
      ownerEmail: user.email,
      provider,
      kind: "connection",
      title: `${provider} disconnected`,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Disconnect failed." },
      { status: 400 },
    );
  }
}
