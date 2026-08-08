import { requireHQOwner, signOutPathForUser } from "../chatgpt-auth";
import { getFinanceWorkspace } from "./data";
import { FinanceDashboard } from "./finance-dashboard";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const user = await requireHQOwner("/finance");
  const workspace = await getFinanceWorkspace(user.email);
  return (
    <FinanceDashboard
      initialWorkspace={workspace}
      user={{
        displayName: user.displayName,
        email: user.email,
        signOutPath: signOutPathForUser(user, "/finance"),
      }}
    />
  );
}
