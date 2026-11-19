import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { RentalDetailPage } from "@/features/rentals/rentals-page";

export default async function Page() {
  if (await demoMode())
    return (
      <StatePanel title="Live feature unavailable in demo" href="/companies">
        Live rental contracts require a real authenticated session.
      </StatePanel>
    );
  return <RentalDetailPage />;
}
