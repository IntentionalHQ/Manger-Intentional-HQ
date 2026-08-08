import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "../../lib/supabase/config";
import { getChatGPTUser, safeReturnPath } from "../chatgpt-auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo ?? "/");
  const user = await getChatGPTUser();
  if (user) redirect(returnTo);
  const authConfigured = Boolean(getSupabasePublicConfig());

  return (
    <main className="login-shell">
      <section className="login-card">
        <span className="brand-mark" aria-hidden="true" />
        <p className="eyebrow">Intentional HQ</p>
        <h1>Sign in to your home base</h1>
        <p className="subhead">
          {authConfigured
            ? "Use your Intentional HQ owner email and password."
            : "The deployment is online. Authentication needs one final setup step."}
        </p>
        <LoginForm
          returnTo={returnTo}
          initialError={params.error}
          configured={authConfigured}
        />
      </section>
    </main>
  );
}
