import { NextRequest, NextResponse } from "next/server";
import { getHQOwner } from "@/app/chatgpt-auth";
import { createHQAdminClient } from "@/lib/supabase/hq-admin";

export async function POST(request: NextRequest) {
  const owner = await getHQOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { start?: unknown; end?: unknown } | null;
  const start = typeof body?.start === "string" ? body.start : "";
  const end = typeof body?.end === "string" ? body.end : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json({ error: "Valid period dates are required." }, { status: 400 });
  }

  const client = createHQAdminClient();
  const { data: business } = await client.from("hq_businesses").select("id").eq("owner_email", owner.email.toLowerCase()).maybeSingle();
  if (!business) return NextResponse.json({ error: "Finance workspace not found." }, { status: 404 });
  const { data, error } = await client.rpc("hq_close_fiscal_period", {
    p_business_id: business.id,
    p_start_date: start,
    p_end_date: end,
    p_actor_email: owner.email,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ periodId: data }, { status: 201 });
}
