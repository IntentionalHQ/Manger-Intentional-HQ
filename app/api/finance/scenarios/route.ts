import { NextRequest, NextResponse } from "next/server";
import { getHQOwner } from "@/app/chatgpt-auth";
import { defaultProjectionInput } from "@/app/finance/projection";
import type { CostProjectionInput } from "@/app/finance/types";
import { createHQAdminClient } from "@/lib/supabase/hq-admin";

const rateKeys = new Set<keyof CostProjectionInput>([
  "bankSyncAdoption",
  "stripeRate",
  "marketingRate",
  "marketplaceCommissionRate",
]);

function sanitizeAssumptions(value: unknown): Partial<CostProjectionInput> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!(key in defaultProjectionInput)) continue;
    const expected = defaultProjectionInput[key as keyof CostProjectionInput];
    if (typeof expected === "number" && typeof item === "number") {
      if (!Number.isFinite(item) || item < 0) return null;
      if (rateKeys.has(key as keyof CostProjectionInput) && item > 1) return null;
      result[key] = item;
    } else if (typeof expected === "string" && typeof item === "string" && item.trim().length <= 120) {
      result[key] = item.trim();
    } else if (typeof expected === "boolean" && typeof item === "boolean") {
      result[key] = item;
    } else {
      return null;
    }
  }
  return result as Partial<CostProjectionInput>;
}

export async function POST(request: NextRequest) {
  const owner = await getHQOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { assumptions?: unknown } | null;
  const assumptions = sanitizeAssumptions(body?.assumptions);
  if (!assumptions) return NextResponse.json({ error: "Scenario assumptions are invalid." }, { status: 400 });

  const client = createHQAdminClient();
  const { data: business } = await client
    .from("hq_businesses")
    .select("id")
    .eq("owner_email", owner.email.toLowerCase())
    .maybeSingle();
  if (!business) return NextResponse.json({ error: "Create the finance workspace first." }, { status: 409 });

  const { data: scenario } = await client
    .from("hq_forecast_scenarios")
    .select("id")
    .eq("business_id", business.id)
    .eq("is_default", true)
    .maybeSingle();
  if (!scenario) return NextResponse.json({ error: "The default scenario is missing." }, { status: 409 });

  const { error } = await client
    .from("hq_forecast_scenarios")
    .update({ assumptions, updated_at: new Date().toISOString() })
    .eq("id", scenario.id)
    .eq("business_id", business.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true });
}
