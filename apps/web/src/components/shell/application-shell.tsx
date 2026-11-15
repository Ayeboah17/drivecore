"use client";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/lib/context/context-provider";
import { useDevelopment } from "@/mocks/development-provider";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DevelopmentControls } from "./development-controls";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { StatePanel } from "@/components/layout/state-panel";
export function ApplicationShell({ children }: { children: React.ReactNode }) {
  const { context, pending, error, retry } = useOrganization();
  const { profile, scenario } = useDevelopment();
  const pathname = usePathname();
  if (pathname === "/companies") return <>{children}</>;
  return (
    <TooltipProvider>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-control bg-surface p-3 text-link hover:text-link-hover focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      {context ? (
        <div
          className="flex min-h-dvh"
          key={`${profile.id}:${scenario}:${context.company.id}:${context.branch.kind === "all" ? "all" : context.branch.branchId}`}
        >
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <Breadcrumbs />
            <main
              id="main-content"
              tabIndex={-1}
              className="min-w-0 flex-1 outline-none"
            >
              {children}
            </main>
          </div>
        </div>
      ) : (
        <div className="flex min-h-dvh flex-col">
          <div className="border-b bg-surface p-page font-semibold">
            DriveCore{" "}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Mock workspace
            </span>
          </div>
          <main id="main-content" tabIndex={-1} className="flex-1 p-page">
            {pending ? (
              <div
                role="status"
                aria-label="Loading organizational context"
                className="space-y-4"
              >
                <Skeleton className="h-8 w-60" />
                <Skeleton className="h-40 w-full" />
                <span className="sr-only">Loading organizational context</span>
              </div>
            ) : (
              <StatePanel
                title={
                  error
                    ? "Access denied or context unavailable"
                    : "No accessible context"
                }
                href="/companies"
                onRetry={retry}
              >
                {error?.message ?? "Select an accessible company to continue."}
              </StatePanel>
            )}
          </main>
        </div>
      )}
      <DevelopmentControls />
    </TooltipProvider>
  );
}
