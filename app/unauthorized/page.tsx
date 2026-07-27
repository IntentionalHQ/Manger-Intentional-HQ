import { redirect } from "next/navigation";
import {
  getChatGPTUser,
  safeReturnPath,
  signOutPathForUser,
} from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getChatGPTUser();
  if (!user) redirect("/");

  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo ?? "/");

  return (
    <main className="login-shell">
      <section className="login-card">
        <span className="brand-mark">H</span>
        <p className="eyebrow">Intentional HQ</p>
        <h1>Owner access required</h1>
        <p className="subhead">
          {user.email} is signed in, but it is not the account authorized to
          view company-wide Scurry and infrastructure data.
        </p>
        <a className="btn btn-primary login-action" href={signOutPathForUser(user, returnTo)}>
          Sign out and use the owner account
        </a>
      </section>
    </main>
  );
}
