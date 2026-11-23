import { Suspense } from "react";
import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { AcceptInviteForm } from "@/features/auth/public-auth-pages";

async function AcceptInviteRoute() {
  if (await demoMode()) {
    return (
      <main className="p-page">
        <StatePanel title="Invitations unavailable in demo" href="/companies">
          The isolated demo does not use live authentication or invitations.
        </StatePanel>
      </main>
    );
  }
  return <AcceptInviteForm />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="p-page" role="status">
          Loading invitation…
        </p>
      }
    >
      <AcceptInviteRoute />
    </Suspense>
  );
}
