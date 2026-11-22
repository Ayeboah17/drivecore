import { Suspense } from "react";
import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { AccountPage } from "@/features/auth/account-page";

async function AccountRoute() {
  if (await demoMode()) {
    return (
      <main className="p-page">
        <StatePanel title="Account settings unavailable in demo" href="/companies">
          The isolated demo does not use live accounts or passwords.
        </StatePanel>
      </main>
    );
  }
  return <AccountPage />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="p-page" role="status">
          Loading account settings…
        </p>
      }
    >
      <AccountRoute />
    </Suspense>
  );
}
