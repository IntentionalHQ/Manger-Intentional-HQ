import { NextRequest, NextResponse } from "next/server";
import { getHQOwner } from "@/app/chatgpt-auth";
import { createHQAdminClient } from "@/lib/supabase/hq-admin";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(request: NextRequest) {
  const owner = await getHQOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const entryId = typeof form?.get("entryId") === "string" ? String(form.get("entryId")) : "";
  const file = form?.get("file");
  if (!entryId || !(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "A journal entry and receipt file are required." }, { status: 400 });
  }
  const extension = allowedTypes.get(file.type);
  if (!extension || file.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ error: "Receipts must be PDF, JPEG, PNG, or WebP files up to 10 MB." }, { status: 400 });
  }

  const client = createHQAdminClient();
  const { data: business } = await client
    .from("hq_businesses")
    .select("id")
    .eq("owner_email", owner.email.toLowerCase())
    .maybeSingle();
  if (!business) return NextResponse.json({ error: "Finance workspace not found." }, { status: 404 });

  const { data: entry } = await client
    .from("hq_journal_entries")
    .select("id")
    .eq("id", entryId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: "Journal entry not found." }, { status: 404 });

  const bucket = process.env.HQ_FINANCE_DOCUMENTS_BUCKET?.trim() || "finance-documents";
  const storagePath = `${business.id}/${entryId}/${crypto.randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: `Receipt upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: receipt, error: receiptError } = await client
    .from("hq_receipts")
    .insert({
      business_id: business.id,
      journal_entry_id: entryId,
      storage_bucket: bucket,
      storage_path: storagePath,
      original_filename: file.name.slice(0, 255),
      content_type: file.type,
      size_bytes: file.size,
      uploaded_by_email: owner.email.toLowerCase(),
    })
    .select("id")
    .single();
  if (receiptError) {
    await client.storage.from(bucket).remove([storagePath]);
    return NextResponse.json({ error: `Receipt record failed: ${receiptError.message}` }, { status: 500 });
  }
  return NextResponse.json({ receiptId: receipt.id }, { status: 201 });
}
