import { Suspense } from "react";
import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { ResetPasswordForm } from "@/features/auth/public-auth-pages";

async function ResetPasswordRoute() {
  if (await demoMode()) {
    return (
      <main className="p-page">
        <StatePanel title="Password reset unavailable in demo" href="/companies">
          The isolated demo does not use live authentication.
        </StatePanel>
      </main>
    );
  }
  return <ResetPasswordForm />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="p-page" role="status">
          Loading password reset…
        </p>
      }
    >
      <ResetPasswordRoute />
    </Suspense>
  );
}
