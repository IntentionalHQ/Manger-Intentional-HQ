import { safeReturnPath } from "../../../chatgpt-auth";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      returnTo?: string;
    };
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return Response.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const returnTo = safeReturnPath(payload.returnTo ?? "/");
    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("returnTo", returnTo);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });
    if (error) throw error;

    return Response.json({
      message: "Check your email for a secure sign-in link.",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The sign-in link could not be sent.",
      },
      { status: 400 },
    );
  }
}
