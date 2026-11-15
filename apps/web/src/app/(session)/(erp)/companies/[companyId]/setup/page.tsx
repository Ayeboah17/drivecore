import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { BranchSetup } from "@/features/setup/branch-setup";
export default async function Page() {
  if (await demoMode())
    return (
      <StatePanel title="Setup unavailable in demo">
        Company and branch creation require a real authenticated session.
      </StatePanel>
    );
  return <BranchSetup />;
}
