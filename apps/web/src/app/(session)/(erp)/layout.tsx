import { Suspense } from "react";
import { demoMode } from "@/lib/server/mode";

import { LiveContext } from "@/features/live/context";
import { LiveShell, Protected } from "@/features/live/shell";
async function Workspace({ children }: { children: React.ReactNode }) {
  if (await demoMode()) {
    const [{ ApplicationProviders }, { ApplicationShell }] = await Promise.all([
      import("@/components/providers/application-providers"),
      import("@/components/shell/application-shell"),
    ]);
    return (
      <ApplicationProviders>
        <ApplicationShell>{children}</ApplicationShell>
      </ApplicationProviders>
    );
  }
  return (
    <Protected>
      <LiveContext>
        <LiveShell>{children}</LiveShell>
      </LiveContext>
    </Protected>
  );
}
export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="p-page" role="status">
          Loading DriveCore…
        </p>
      }
    >
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}
