import { NextRequest, NextResponse } from "next/server";
import { getHQOwner } from "@/app/chatgpt-auth";
import { validateJournalEntry } from "@/app/finance/ledger";
import type { JournalEntry } from "@/app/finance/types";
import { createHQAdminClient } from "@/lib/supabase/hq-admin";

type LineInput = {
  accountId?: unknown;
  debitCents?: unknown;
  creditCents?: unknown;
  description?: unknown;
};

export async function POST(request: NextRequest) {
  const owner = await getHQOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    entryDate?: unknown;
    memo?: unknown;
    lines?: unknown;
  } | null;
  const entryDate = typeof body?.entryDate === "string" ? body.entryDate : "";
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  const rawLines = Array.isArray(body?.lines) ? (body.lines as LineInput[]) : [];
  const lines = rawLines.map((line, index) => ({
    id: `request-${index}`,
    accountId: typeof line.accountId === "string" ? line.accountId : "",
    debitCents: Number(line.debitCents ?? 0),
    creditCents: Number(line.creditCents ?? 0),
    description: typeof line.description === "string" ? line.description.trim() : undefined,
  }));
  const candidate: JournalEntry = {
    id: "request",
    entryNumber: 0,
    entryDate,
    memo,
    status: "draft",
    sourceType: "manual",
    postedAt: null,
    lines,
  };
  const errors = validateJournalEntry(candidate);
  if (!memo || memo.length > 500) errors.push("Memo must be between 1 and 500 characters.");
  if (lines.some((line) => !line.accountId)) errors.push("Every line needs an account.");
  if (errors.length) {
    return NextResponse.json({ error: [...new Set(errors)].join(" ") }, { status: 400 });
  }

  const client = createHQAdminClient();
  const { data: business, error: businessError } = await client
    .from("hq_businesses")
    .select("id")
    .eq("owner_email", owner.email.toLowerCase())
    .maybeSingle();
  if (businessError || !business) {
    return NextResponse.json({ error: "Create the finance workspace before posting entries." }, { status: 409 });
  }

  const { data, error } = await client.rpc("hq_create_journal_entry", {
    p_business_id: business.id,
    p_entry_date: entryDate,
    p_memo: memo,
    p_source_type: "manual",
    p_source_id: "",
    p_actor_email: owner.email,
    p_lines: lines.map((line) => ({
      account_id: line.accountId,
      debit_cents: line.debitCents,
      credit_cents: line.creditCents,
      description: line.description ?? "",
    })),
    p_post: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entryId: data }, { status: 201 });
}
