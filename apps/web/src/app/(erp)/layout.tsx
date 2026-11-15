import { ApplicationShell } from "@/components/shell/application-shell";
import { Suspense } from "react";
import { ApplicationProviders } from "@/components/providers/application-providers";
export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="p-page" role="status">
          Loading DriveCore mock workspace…
        </p>
      }
    >
      <ApplicationProviders>
        <ApplicationShell>{children}</ApplicationShell>
      </ApplicationProviders>
    </Suspense>
  );
}
