"use client";
import { DevelopmentControls } from "@/components/shell/development-controls";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/context/context-provider";
import { dashboardPath } from "@/lib/context/url";
import { readPreference } from "@/lib/context/preferences";
export default function CompaniesEntry() {
  const { directory, directoryPending, directoryError } = useOrganization();
  const router = useRouter();
  useEffect(() => {
    if (!directory.length) return;
    const preferred = readPreference("company");
    router.replace(
      dashboardPath(
        directory.find((c) => c.id === preferred)?.id ?? directory[0].id,
      ),
    );
  }, [directory, router]);
  return (
    <main className="p-page">
      <h1 className="text-page-title">DriveCore · Mock workspace</h1>
      <p role="status">
        {directoryPending
          ? "Loading development profile…"
          : directoryError
            ? directoryError.message
            : directory.length
              ? "Opening your workspace…"
              : "No companies are accessible to this simulated profile."}
      </p>
      <div className="mt-6">
        <DevelopmentControls />
      </div>
    </main>
  );
}
