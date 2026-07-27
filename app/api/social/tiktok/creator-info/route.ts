import { getHQOwner } from "../../../../chatgpt-auth";
import { readTikTokCreatorInfo } from "../../../../integrations/tiktok";

export async function GET() {
  const user = await getHQOwner();
  if (!user) return Response.json({ error: "Owner access required." }, { status: 403 });
  try {
    return Response.json(await readTikTokCreatorInfo(user.email));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Creator check failed." },
      { status: 400 },
    );
  }
}
