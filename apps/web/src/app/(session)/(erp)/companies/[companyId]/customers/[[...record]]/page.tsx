import { RecordPage } from "@/features/records/page";
import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
export default async function Page() {
  if (await demoMode())
    return (
      <StatePanel title="Live feature unavailable in demo" href="/companies">
        Customer and vehicle management require a real authenticated session. No
        changes can be submitted from the demo.
      </StatePanel>
    );
  return <RecordPage domain="customers" />;
}
