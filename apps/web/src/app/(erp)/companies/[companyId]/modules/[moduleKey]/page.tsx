import { demoMode } from "@/lib/server/mode";
import { UnavailablePage } from "@/features/live/pages";
export default async function Page() {
  if (await demoMode()) {
    const Demo = (await import("@/features/planned/planned-module-page"))
      .PlannedModulePage;
    return <Demo />;
  }
  return <UnavailablePage />;
}
