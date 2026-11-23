import { Suspense } from "react";
import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { ForgotPasswordForm } from "@/features/auth/public-auth-pages";

async function ForgotPasswordRoute() {
  if (await demoMode()) {
    return (
      <main className="p-page">
        <StatePanel title="Password reset unavailable in demo" href="/companies">
          The isolated demo does not use live authentication.
        </StatePanel>
      </main>
    );
  }
  return <ForgotPasswordForm />;
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
      <ForgotPasswordRoute />
    </Suspense>
  );
}
