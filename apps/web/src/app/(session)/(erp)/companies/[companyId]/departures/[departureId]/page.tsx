import { demoMode } from "@/lib/server/mode";
import { UnavailablePage } from "@/features/live/pages";
export default async function Page() {
  if (await demoMode()) {
    const Demo = (await import("@/features/operations/departure-detail"))
      .DepartureDetailPage;
    return <Demo />;
  }
  return <UnavailablePage title="Departure" />;
}
