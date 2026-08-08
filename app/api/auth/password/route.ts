import { NextResponse } from "next/server";
import { safeReturnPath } from "../../../chatgpt-auth";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const ownerEmail = process.env.HQ_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) {
    return NextResponse.json(
      { error: "Password sign-in is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    returnTo?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const returnTo = safeReturnPath(
    typeof body?.returnTo === "string" ? body.returnTo : "/",
  );

  if (email !== ownerEmail || password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || data.user?.email?.toLowerCase() !== ownerEmail) {
    await supabase.auth.signOut().catch(() => undefined);
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  return NextResponse.json({ redirectTo: returnTo });
}
