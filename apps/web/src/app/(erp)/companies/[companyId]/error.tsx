"use client";
import { StatePanel } from "@/components/layout/state-panel";
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <div className="p-page">
      <StatePanel title="Workspace could not load" onRetry={reset}>
        Try loading this page again. No operational changes were made.
      </StatePanel>
    </div>
  );
}
