export function getSupabasePublicConfig() {
  const url =
    process.env.SCURRY_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SCURRY_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}
