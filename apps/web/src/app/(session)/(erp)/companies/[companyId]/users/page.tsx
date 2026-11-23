import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { UsersAdminPage } from "@/features/users/users-page";

export default async function Page() {
  if (await demoMode())
    return (
      <StatePanel title="Live feature unavailable in demo" href="/companies">
        User and role administration require a real authenticated session. No
        changes can be submitted from the demo.
      </StatePanel>
    );
  return <UsersAdminPage />;
}
