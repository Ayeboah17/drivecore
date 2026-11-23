import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { LiveOperationsPage } from "@/features/live-operations/operations-page";

export default async function Page() {
  if (await demoMode())
    return (
      <StatePanel title="Live feature unavailable in demo" href="/companies">
        Live dispatch and document storage require a real authenticated session.
      </StatePanel>
    );
  return <LiveOperationsPage />;
}
