import { NextRequest, NextResponse } from "next/server";
import { getHQOwner } from "@/app/chatgpt-auth";
import { createHQAdminClient } from "@/lib/supabase/hq-admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const owner = await getHQOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { reason?: unknown; date?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const date = typeof body?.date === "string" ? body.date : "";
  if (!reason || reason.length > 500 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid reversal date and reason are required." }, { status: 400 });
  }

  const client = createHQAdminClient();
  const { data: business } = await client.from("hq_businesses").select("id").eq("owner_email", owner.email.toLowerCase()).maybeSingle();
  if (!business) return NextResponse.json({ error: "Finance workspace not found." }, { status: 404 });
  const { data: entry } = await client.from("hq_journal_entries").select("id").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!entry) return NextResponse.json({ error: "Journal entry not found." }, { status: 404 });

  const { data, error } = await client.rpc("hq_reverse_journal_entry", {
    p_entry_id: id,
    p_reversal_date: date,
    p_actor_email: owner.email,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ reversalEntryId: data }, { status: 201 });
}
