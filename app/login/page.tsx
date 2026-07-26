import { redirect } from "next/navigation";
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

  return (
    <main className="login-shell">
      <section className="login-card">
        <span className="brand-mark">H</span>
        <p className="eyebrow">Intentional HQ</p>
        <h1>Sign in to your home base</h1>
        <p className="subhead">
          Use the same email as Scurry. We will send you a secure magic link.
        </p>
        <LoginForm returnTo={returnTo} initialError={params.error} />
      </section>
    </main>
  );
}
