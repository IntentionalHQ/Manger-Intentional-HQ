import { getHQOwner } from "../../chatgpt-auth";
import { addScurryTask } from "../../scurry";

export async function POST(request: Request) {
  const user = await getHQOwner();
  if (!user) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as {
      title?: string;
      notes?: string;
      dueDate?: string;
      priority?: "low" | "medium" | "high" | "urgent";
    };
    const task = await addScurryTask(user.email, {
      title: payload.title ?? "",
      notes: payload.notes,
      dueDate: payload.dueDate,
      priority: payload.priority,
    });
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "The task could not be added.",
      },
      { status: 400 },
    );
  }
}
