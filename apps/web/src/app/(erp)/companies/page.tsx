import { demoMode } from "@/lib/server/mode";
import { CompaniesPage } from "@/features/live/pages";
export default async function Page() {
  if (await demoMode()) {
    const Demo = (await import("@/mocks/companies-entry")).default;
    return <Demo />;
  }
  return <CompaniesPage />;
}
