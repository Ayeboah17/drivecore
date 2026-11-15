import { Suspense } from "react";
import { LiveProviders } from "@/features/auth/session-provider";
import { LoginForm } from "@/features/auth/login-form";
export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="p-page" role="status">
          Loading sign in…
        </p>
      }
    >
      <LiveProviders>
        <LoginForm />
      </LiveProviders>
    </Suspense>
  );
}
