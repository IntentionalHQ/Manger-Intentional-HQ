import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ScurryTaskRow = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done";
  section: "inbox" | "scheduled" | "backlog" | "project" | "note";
  due_date: string;
  time: string;
  priority: "low" | "medium" | "high" | "urgent";
  flag: boolean;
  updated_at: string;
  created_at: string;
};

export type ScurryTask = {
  id: string;
  title: string;
  dueDate: string;
  time: string;
  priority: ScurryTaskRow["priority"];
  section: ScurryTaskRow["section"];
  flag: boolean;
};

export type ScurrySummary = {
  status: "connected" | "error";
  tasks: ScurryTask[];
  todayCount: number;
  overdueCount: number;
  openCount: number;
  lastSyncedAt: string;
  error?: string;
};

function getClient(): SupabaseClient {
  const url = process.env.SCURRY_SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SCURRY_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Scurry Supabase is not configured.");
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function resolveScurryUserId(email: string): Promise<string> {
  const client = getClient();
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new Error("Scurry account lookup failed.");

  const matchedUser = data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );

  if (!matchedUser) {
    throw new Error(
      "No Scurry account uses the same email as this HQ sign-in.",
    );
  }

  return matchedUser.id;
}

function todayInConfiguredZone() {
  const timeZone = process.env.HQ_TIME_ZONE || "America/New_York";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function readScurrySummary(
  email: string,
): Promise<ScurrySummary> {
  try {
    const client = getClient();
    const userId = await resolveScurryUserId(email);
    const { data, error } = await client
      .from("tasks")
      .select(
        "id,title,status,section,due_date,time,priority,flag,updated_at,created_at",
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .neq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Scurry tasks could not be read.");

    const rows = (data ?? []) as ScurryTaskRow[];
    const today = todayInConfiguredZone();
    const todayRows = rows.filter(
      (task) =>
        task.section === "inbox" ||
        task.due_date === today ||
        (!!task.due_date && task.due_date < today) ||
        task.flag,
    );

    return {
      status: "connected",
      tasks: todayRows.slice(0, 8).map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: task.due_date,
        time: task.time,
        priority: task.priority,
        section: task.section,
        flag: task.flag,
      })),
      todayCount: todayRows.length,
      overdueCount: rows.filter(
        (task) => !!task.due_date && task.due_date < today,
      ).length,
      openCount: rows.length,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      tasks: [],
      todayCount: 0,
      overdueCount: 0,
      openCount: 0,
      lastSyncedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Scurry sync failed.",
    };
  }
}

export async function addScurryTask(
  email: string,
  input: {
    title: string;
    notes?: string;
    dueDate?: string;
    priority?: ScurryTaskRow["priority"];
  },
) {
  const client = getClient();
  const userId = await resolveScurryUserId(email);
  const title = input.title.trim();
  const dueDate = input.dueDate?.trim() ?? "";
  const priorities = new Set(["low", "medium", "high", "urgent"]);
  const priority = priorities.has(input.priority ?? "")
    ? input.priority!
    : "medium";

  if (!title) throw new Error("Task title is required.");
  if (title.length > 500) throw new Error("Task title is too long.");
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new Error("Due date must use YYYY-MM-DD.");
  }

  const { data, error } = await client
    .from("tasks")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      notes: input.notes?.trim() ?? "",
      status: "open",
      section: dueDate ? "scheduled" : "inbox",
      due_date: dueDate,
      time: "",
      priority,
      repeat_frequency: "none",
      end_repeat: "",
      tags: [],
      flag: false,
    })
    .select("id")
    .single();

  if (error) throw new Error("Scurry did not accept the new task.");
  return data;
}
