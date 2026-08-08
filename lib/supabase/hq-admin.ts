import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getHQDatabaseConfig() {
  const url = process.env.HQ_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRoleKey = process.env.HQ_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export function isHQDatabaseConfigured() {
  return getHQDatabaseConfig() !== null;
}

export function createHQAdminClient(): SupabaseClient {
  const config = getHQDatabaseConfig();
  if (!config) {
    throw new Error(
      "The Intentional HQ database is not configured. Add HQ_SUPABASE_URL and HQ_SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
