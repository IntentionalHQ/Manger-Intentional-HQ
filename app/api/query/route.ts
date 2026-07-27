import { getHQOwner } from "../../chatgpt-auth";
import {
  recordActivity,
  runReadOnlyQuery,
  saveQuery,
} from "../../integrations/store";

export async function POST(request: Request) {
  const user = await getHQOwner();
  if (!user) return Response.json({ error: "Owner access required." }, { status: 403 });
  try {
    const payload = (await request.json()) as {
      query?: string;
      save?: boolean;
      name?: string;
    };
    const query = payload.query?.trim() ?? "";
    const rows = await runReadOnlyQuery(query);
    if (payload.save) {
      await saveQuery(user.email, payload.name ?? "", query);
    }
    await recordActivity({
      ownerEmail: user.email,
      provider: "supabase-scurry",
      kind: "query",
      title: payload.save
        ? `Saved query completed: ${payload.name ?? "Untitled"}`
        : "Read-only query completed",
    });
    return Response.json({ rows });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Query failed." },
      { status: 400 },
    );
  }
}
