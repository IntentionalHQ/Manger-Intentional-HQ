import { getHQOwner } from "../../../chatgpt-auth";
import { createMediaUpload } from "../../../integrations/store";

export async function POST(request: Request) {
  const user = await getHQOwner();
  if (!user) return Response.json({ error: "Owner access required." }, { status: 403 });
  try {
    const payload = (await request.json()) as {
      filename?: string;
      contentType?: string;
    };
    if (!payload.filename?.trim() || !payload.contentType?.trim()) {
      throw new Error("Filename and content type are required.");
    }
    return Response.json(
      await createMediaUpload(
        user.email,
        payload.filename.trim(),
        payload.contentType.trim(),
      ),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload setup failed." },
      { status: 400 },
    );
  }
}
