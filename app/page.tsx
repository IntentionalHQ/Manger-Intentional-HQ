import {
  requireChatGPTUser,
  signOutPathForUser,
} from "./chatgpt-auth";
import { Dashboard } from "./dashboard";
import { getDashboardData } from "./hq-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  const data = await getDashboardData(user.email);

  return (
    <Dashboard
      initialData={data}
      user={{
        displayName: user.displayName,
        email: user.email,
        signOutPath: signOutPathForUser(user, "/"),
      }}
    />
  );
}
