"use client";
import { useParams } from "next/navigation";
import { useDevelopment } from "@/mocks/development-provider";
import { findModule } from "@/lib/navigation/definitions";
import { PageLayout } from "@/components/layout/page-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatePanel } from "@/components/layout/state-panel";
export function PlannedModulePage() {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const { profile } = useDevelopment();
  const item = findModule(moduleKey);
  return (
    <PageLayout>
      {!item || item.availability !== "planned" ? (
        <StatePanel title="Destination unavailable">
          This destination does not exist.
        </StatePanel>
      ) : !profile.modules.includes(item.key) ? (
        <StatePanel title="Access denied">
          This simulated profile cannot access this destination.
        </StatePanel>
      ) : (
        <>
          <PageHeader title={item.label} />
          <section className="max-w-2xl rounded-card border bg-surface p-card">
            <span className="text-label font-medium text-muted-foreground">
              Planned functionality
            </span>
            <h2 className="mt-2 text-section-heading">
              {item.label} is planned
            </h2>
            <p className="mt-3 text-muted-foreground">{item.description}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Milestone 2 provides operational visibility from the dashboard.
              This module has no working records or actions yet.
            </p>
          </section>
        </>
      )}
    </PageLayout>
  );
}
