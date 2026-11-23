import { demoMode } from "@/lib/server/mode";
import { StatePanel } from "@/components/layout/state-panel";
import { QuotationDetailPage } from "@/features/quotations/quotations-page";

export default async function Page() {
  if (await demoMode())
    return (
      <StatePanel title="Live feature unavailable in demo" href="/companies">
        Live quotations require a real authenticated session.
      </StatePanel>
    );
  return <QuotationDetailPage />;
}
