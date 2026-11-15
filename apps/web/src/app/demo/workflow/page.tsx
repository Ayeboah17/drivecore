import type { Metadata } from "next";
import { WorkflowDemo } from "@/features/workflow-demo/workflow-demo";
import { Suspense } from "react";
export const metadata: Metadata = {
  title: "DriveCore | Workflow demo",
  description: "An isolated browser-persisted demo workspace using fictional data only.",
};
export default function Page() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-page">
          Loading demo workspace…
        </p>
      }
    >
      <WorkflowDemo />
    </Suspense>
  );
}
