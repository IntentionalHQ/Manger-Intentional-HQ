import { NextResponse } from "next/server";
import { safeReturnPath } from "../../chatgpt-auth";
import { getSupabasePublicConfig } from "../../../lib/supabase/config";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeReturnPath(
    requestUrl.searchParams.get("returnTo") ?? "/",
  );

  if (getSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL(returnTo, requestUrl.origin));
}
