import { NextRequest, NextResponse } from "next/server";
import { getHQOwner } from "@/app/chatgpt-auth";
import { createHQAdminClient } from "@/lib/supabase/hq-admin";

export async function POST(request: NextRequest) {
  const owner = await getHQOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "Company name must be between 2 and 120 characters." }, { status: 400 });
  }

  const client = createHQAdminClient();
  const { data: existing } = await client
    .from("hq_businesses")
    .select("id")
    .eq("owner_email", owner.email.toLowerCase())
    .maybeSingle();
  if (existing) return NextResponse.json({ businessId: existing.id, created: false });

  const { data, error } = await client.rpc("hq_create_business", {
    p_owner_email: owner.email,
    p_name: name,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ businessId: data, created: true }, { status: 201 });
}
