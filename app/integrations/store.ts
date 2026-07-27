import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "./crypto";
import type {
  PublishRequest,
  SocialProvider,
  StoredConnection,
  TokenBundle,
} from "./types";

type ConnectionRow = {
  owner_email: string;
  provider: SocialProvider;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  external_account_id: string | null;
  external_account_name: string | null;
  scopes: string[] | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

function adminClient(): SupabaseClient {
  const url = (
    process.env.SCURRY_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.replace(/\/+$/, "");
  const serviceRoleKey =
    process.env.SCURRY_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
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

function missingTableMessage(): string {
  return "Run supabase/hq_integrations.sql in the Scurry Supabase SQL editor.";
}

export async function readConnection(
  ownerEmail: string,
  provider: SocialProvider,
): Promise<StoredConnection | null> {
  const { data, error } = await adminClient()
    .from("hq_connections")
    .select(
      "owner_email,provider,access_token_encrypted,refresh_token_encrypted,token_expires_at,external_account_id,external_account_name,scopes,metadata,updated_at",
    )
    .eq("owner_email", ownerEmail.toLowerCase())
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new Error(missingTableMessage());
    }
    throw new Error(`The ${provider} connection could not be read.`);
  }
  if (!data) return null;

  const row = data as ConnectionRow;
  return {
    provider: row.provider,
    ownerEmail: row.owner_email,
    accessToken: await decryptSecret(row.access_token_encrypted),
    refreshToken: row.refresh_token_encrypted
      ? await decryptSecret(row.refresh_token_encrypted)
      : null,
    expiresAt: row.token_expires_at,
    externalAccountId: row.external_account_id,
    externalAccountName: row.external_account_name,
    scopes: row.scopes ?? [],
    metadata: row.metadata ?? {},
    updatedAt: row.updated_at,
  };
}

export async function saveConnection(
  ownerEmail: string,
  provider: SocialProvider,
  bundle: TokenBundle,
): Promise<void> {
  const payload = {
    owner_email: ownerEmail.toLowerCase(),
    provider,
    access_token_encrypted: await encryptSecret(bundle.accessToken),
    refresh_token_encrypted: bundle.refreshToken
      ? await encryptSecret(bundle.refreshToken)
      : null,
    token_expires_at: bundle.expiresAt ?? null,
    external_account_id: bundle.externalAccountId ?? null,
    external_account_name: bundle.externalAccountName ?? null,
    scopes: bundle.scopes ?? [],
    metadata: bundle.metadata ?? {},
    updated_at: new Date().toISOString(),
  };
  const { error } = await adminClient()
    .from("hq_connections")
    .upsert(payload, { onConflict: "owner_email,provider" });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new Error(missingTableMessage());
    }
    throw new Error(`The ${provider} connection could not be saved.`);
  }
}

export async function deleteConnection(
  ownerEmail: string,
  provider: SocialProvider,
): Promise<void> {
  const { error } = await adminClient()
    .from("hq_connections")
    .delete()
    .eq("owner_email", ownerEmail.toLowerCase())
    .eq("provider", provider);
  if (error) throw new Error(`The ${provider} connection could not be removed.`);
}

export async function recordActivity(input: {
  ownerEmail: string;
  provider: string;
  kind: string;
  title: string;
  detail?: string;
  externalId?: string;
}): Promise<void> {
  const { error } = await adminClient().from("hq_activity_events").insert({
    owner_email: input.ownerEmail.toLowerCase(),
    provider: input.provider,
    kind: input.kind,
    title: input.title,
    detail: input.detail ?? null,
    external_id: input.externalId ?? null,
  });
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    throw new Error("HQ activity could not be recorded.");
  }
}

export async function readActivity(ownerEmail: string) {
  const { data, error } = await adminClient()
    .from("hq_activity_events")
    .select("id,provider,kind,title,detail,external_id,created_at")
    .eq("owner_email", ownerEmail.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: String(row.id),
    provider: String(row.provider),
    kind: String(row.kind),
    title: String(row.title),
    detail: row.detail ? String(row.detail) : null,
    externalId: row.external_id ? String(row.external_id) : null,
    createdAt: String(row.created_at),
  }));
}

export async function schedulePost(
  ownerEmail: string,
  targets: SocialProvider[],
  request: PublishRequest,
): Promise<string> {
  const { data, error } = await adminClient()
    .from("hq_scheduled_posts")
    .insert({
      owner_email: ownerEmail.toLowerCase(),
      targets,
      payload: request,
      scheduled_for: request.scheduledAt,
      status: "scheduled",
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      error?.code === "42P01" || error?.code === "PGRST205"
        ? missingTableMessage()
        : "The post could not be scheduled.",
    );
  }
  return String(data.id);
}

export async function readDuePosts() {
  const { data, error } = await adminClient()
    .from("hq_scheduled_posts")
    .select("id,owner_email,targets,payload")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(20);
  if (error) throw new Error("Scheduled posts could not be read.");
  return (data ?? []) as Array<{
    id: string;
    owner_email: string;
    targets: SocialProvider[];
    payload: PublishRequest;
  }>;
}

export async function finishScheduledPost(
  id: string,
  status: "published" | "failed",
  results: unknown,
): Promise<void> {
  const { error } = await adminClient()
    .from("hq_scheduled_posts")
    .update({
      status,
      results,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error("Scheduled post status could not be saved.");
}

export async function runReadOnlyQuery(query: string): Promise<unknown> {
  const normalized = query.trim();
  if (normalized.length < 6 || normalized.length > 10_000) {
    throw new Error("Query must be between 6 and 10,000 characters.");
  }
  const { data, error } = await adminClient().rpc("hq_run_readonly_query", {
    query_text: normalized,
  });
  if (error) {
    throw new Error(
      error.code === "PGRST202"
        ? `${missingTableMessage()} The read-only query function is missing.`
        : error.message,
    );
  }
  return data;
}

export async function saveQuery(
  ownerEmail: string,
  name: string,
  query: string,
): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 80) {
    throw new Error("Saved query name must be between 1 and 80 characters.");
  }
  const { error } = await adminClient().from("hq_saved_queries").upsert(
    {
      owner_email: ownerEmail.toLowerCase(),
      name: normalizedName,
      query_text: query.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_email,name" },
  );
  if (error) {
    throw new Error(
      error.code === "42P01" || error.code === "PGRST205"
        ? missingTableMessage()
        : "The query could not be saved.",
    );
  }
}

export async function readSavedQueries(ownerEmail: string) {
  const { data, error } = await adminClient()
    .from("hq_saved_queries")
    .select("id,name,query_text,updated_at")
    .eq("owner_email", ownerEmail.toLowerCase())
    .order("name", { ascending: true })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    query: String(row.query_text),
    updatedAt: String(row.updated_at),
  }));
}

async function ownerPath(ownerEmail: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ownerEmail.toLowerCase()),
  );
  return Array.from(new Uint8Array(digest).slice(0, 10), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createMediaUpload(
  ownerEmail: string,
  filename: string,
  contentType: string,
) {
  if (!/^(video|image)\//.test(contentType)) {
    throw new Error("Only video and image uploads are supported.");
  }
  const extension = filename.toLowerCase().match(/\.[a-z0-9]{1,8}$/)?.[0] ?? "";
  const bucket = process.env.HQ_MEDIA_BUCKET?.trim() || "hq-media";
  const path = `${await ownerPath(ownerEmail)}/${crypto.randomUUID()}${extension}`;
  const client = adminClient();
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    throw new Error(
      `Create the public Supabase Storage bucket "${bucket}" before uploading media.`,
    );
  }
  const publicUrl = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return {
    signedUrl: data.signedUrl,
    publicUrl,
    path,
    contentType,
  };
}
