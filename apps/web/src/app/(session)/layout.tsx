import { Suspense } from "react";
import { demoMode } from "@/lib/server/mode";
import { LiveProviders } from "@/features/auth/session-provider";

async function SessionBoundary({ children }: { children: React.ReactNode }) {
  // One session/cache owner survives /login <-> /companies client navigation.
  // The public workflow demo is outside this group; the isolated M2 server needs no live session.
  if (await demoMode()) return children;
  return <LiveProviders>{children}</LiveProviders>;
}
export default function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <p className="p-page" role="status">
          Loading DriveCore…
        </p>
      }
    >
      <SessionBoundary>{children}</SessionBoundary>
    </Suspense>
  );
}
