import { Suspense } from "react";
import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { LoginForm } from "@/features/auth/login-form";
async function SignIn() {
  if (await demoMode())
    return (
      <main className="p-page">
        <StatePanel title="Sign-in unavailable in demo" href="/companies">
          The isolated demo does not use live authentication.
        </StatePanel>
      </main>
    );
  return <LoginForm />;
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="p-page" role="status">
          Loading sign in…
        </p>
      }
    >
      <SignIn />
    </Suspense>
  );
}
