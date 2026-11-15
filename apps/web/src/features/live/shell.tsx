"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, ChevronRight, MapPin, Menu } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { LiveNavigation } from "./navigation";
import { WorkspaceHeader } from "./workspace-header";
import {
  LiveAccountMenu,
  LiveLogoutAlert,
  useLiveLogout,
} from "./account-menu";
import { hasWholeCompanyDirectory } from "@/features/setup/contracts";
import { errorText } from "@/lib/api/client";
import { useLiveContext } from "./context";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/layout/state-panel";
import { DriveCoreLogo } from "@/components/brand/drivecore-mark";
import { DriveCoreMotionProvider } from "@/components/motion/primitives";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Protected({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (!session.pending && !session.error && !session.user)
      router.replace(
        `/login?next=${encodeURIComponent(path + (search.size ? `?${search}` : ""))}`,
      );
  }, [session.pending, session.error, session.user, router, path, search]);
  if (session.pending)
    return (
      <p className="p-page" role="status">
        Restoring your session…
      </p>
    );
  if (session.error)
    return (
      <main className="p-page">
        <StatePanel
          title="Session unavailable"
          onRetry={session.refresh}
          href="/demo/workflow"
          linkLabel="Try workflow demo"
        >
          {errorText(session.error)}
        </StatePanel>
      </main>
    );
  if (!session.user)
    return (
      <p className="p-page" role="status">
        Opening sign in…
      </p>
    );
  return children;
}

function Selectors() {
  const { user } = useSession();
  const scope = useLiveContext();
  const branches =
    scope.directory?.branches.filter(
      (b) => String(b.company_id) === scope.companyId,
    ) ?? [];
  const assigned = user!.companies.find(
    (c) => String(c.id) === scope.companyId,
  )?.branch_id;

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
      <Select
        value={scope.companyId}
        onValueChange={(value) => {
          if (value) scope.navigate(`/companies/${value}/dashboard?branch=all`);
        }}
      >
        <SelectTrigger
          aria-label="Company"
          className="h-9 min-w-[140px] flex-1 gap-1.5 rounded-xl bg-surface/90 px-2.5 text-xs font-medium lg:w-44 lg:flex-initial"
        >
          <Building2
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
          <SelectValue>{scope.company?.name ?? "Select company"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {scope.directory?.companies.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={scope.branch}
        onValueChange={(value) => {
          if (value)
            scope.navigate(
              `/companies/${scope.companyId}/dashboard?branch=${value}`,
            );
        }}
      >
        <SelectTrigger
          aria-label="Branch"
          className="h-9 min-w-[140px] flex-1 gap-1.5 rounded-xl bg-surface/90 px-2.5 text-xs font-medium lg:w-48 lg:flex-initial"
        >
          <MapPin
            aria-hidden="true"
            className="size-3.5 shrink-0 text-link"
          />
          <SelectValue>
            {scope.branch === "all"
              ? "All accessible branches"
              : (branches.find((b) => String(b.id) === scope.branch)?.name ??
                `Assigned branch #${scope.branch}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All accessible branches</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={String(b.id)}>
              {b.name}
            </SelectItem>
          ))}
          {assigned && !branches.some((b) => b.id === assigned) ? (
            <SelectItem value={String(assigned)}>
              Assigned branch #{assigned}
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}

export function LiveShell({ children }: { children: React.ReactNode }) {
  const scope = useLiveContext();
  const session = useSession();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { pending, error, logout, renewCsrf } = useLiveLogout();

  const needsSetup = !!(
    session.user &&
    scope.company &&
    !scope.pending &&
    !scope.error &&
    scope.directory?.branchesAvailable &&
    hasWholeCompanyDirectory(session.user, scope.companyId) &&
    !scope.directory.branches.some(
      (branch) => String(branch.company_id) === scope.companyId,
    ) &&
    path !== `/companies/${scope.companyId}/setup`
  );

  useEffect(() => {
    if (needsSetup)
      router.replace(`/companies/${scope.companyId}/setup?branch=all`);
  }, [needsSetup, router, scope.companyId]);

  if (needsSetup)
    return (
      <p role="status" className="p-page">
        Opening branch setup…
      </p>
    );

  if (path === "/companies")
    return (
      <DriveCoreMotionProvider>
        <div className="min-h-dvh">
          <WorkspaceHeader />
          <main
            id="workspace-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1600px] px-page py-8 outline-none sm:py-10"
          >
            {children}
          </main>
        </div>
      </DriveCoreMotionProvider>
    );

  if (scope.pending)
    return (
      <p role="status" className="p-page">
        Loading organization access…
      </p>
    );

  if (scope.error || !scope.company)
    return (
      <DriveCoreMotionProvider>
        <div className="min-h-dvh">
          <WorkspaceHeader />
          <main className="mx-auto w-full max-w-[1600px] space-y-6 p-page">
            <StatePanel
              title="Context unavailable"
              onRetry={scope.retry}
              href="/companies"
            >
              {scope.error?.message ?? "Select an accessible company."}
            </StatePanel>
          </main>
        </div>
      </DriveCoreMotionProvider>
    );

  const routeSegments = path.split("/").filter(Boolean).slice(2);

  return (
    <DriveCoreMotionProvider>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:rounded-control focus:bg-surface focus:p-3 focus:outline-2 focus:outline-ring"
        >
          Skip to content
        </a>

        {/* TOP FLOATING TWO-TIER GLASSMORPHIC HEADER */}
        <header
          data-testid="topbar"
          className="sticky top-0 z-30 px-2.5 pt-2.5 pb-1.5 sm:px-3"
        >
          <div className="dc-glass-panel dc-shadow-float mx-auto max-w-[1600px] rounded-2xl border px-3 py-2 sm:px-3.5">
            {/* Tier 1: Brand + Context Selectors + Theme & Account */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="lg:hidden">
                  <Sheet open={open} onOpenChange={setOpen}>
                    <SheetTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Open navigation"
                          className="size-9 rounded-xl bg-surface/90"
                        />
                      }
                    >
                      <Menu className="size-4" aria-hidden="true" />
                    </SheetTrigger>
                    <SheetContent side="left" className="w-sidebar p-0">
                      <div className="border-b px-4 py-3.5">
                        <SheetTitle>
                          <DriveCoreLogo badge="LIVE" />
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                          Company workspace
                        </SheetDescription>
                      </div>
                      <LiveNavigation
                        variant="vertical"
                        close={() => setOpen(false)}
                      />
                    </SheetContent>
                  </Sheet>
                </div>

                <Link
                  href={`/companies/${scope.companyId}/dashboard?branch=${scope.branch}`}
                  className="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label="DriveCore workspace home"
                >
                  <DriveCoreLogo
                    badge="LIVE"
                    subtitle="Fleet · Maintenance · Finance"
                  />
                </Link>
              </div>

              {/* Center Selectors (wraps onto its own row below Tier 1 on <lg, inline on lg+) */}
              <div className="order-last w-full border-t pt-2 lg:order-none lg:w-auto lg:border-t-0 lg:pt-0">
                <Selectors />
              </div>

              {/* Right Cluster: Theme Toggle + Charcoal Account Dropdown */}
              <div className="flex min-w-0 items-center gap-2">
                <ThemeToggle />
                <LiveAccountMenu
                  pending={pending}
                  showWorkspacesLink
                  onLogout={() => {
                    void logout();
                  }}
                />
              </div>
            </div>

            {/* Tier 2: Desktop Floating Pill Navigation */}
            <div className="mt-2 hidden border-t pt-2 lg:block">
              <LiveNavigation variant="horizontal" />
            </div>
          </div>
        </header>

        <LiveLogoutAlert
          error={error}
          pending={pending}
          onRetry={() => {
            void logout();
          }}
          onRenewCsrf={renewCsrf}
        />

        {/* Subtle Contextual Breadcrumb Strip */}
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-1.5 px-3 pt-3 text-xs text-muted-foreground sm:px-page">
          <Link
            href="/companies"
            className="font-medium text-link hover:text-link-hover hover:underline"
          >
            Companies
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5 opacity-60" />
          <span className="font-medium text-foreground">{scope.company.name}</span>
          {routeSegments.map((segment) => (
            <span key={segment} className="inline-flex items-center gap-1.5">
              <ChevronRight aria-hidden="true" className="size-3.5 opacity-60" />
              <span className="font-mono capitalize text-muted-foreground">
                {segment}
              </span>
            </span>
          ))}
        </div>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-3 py-5 outline-none sm:px-page sm:py-6"
          key={`${session.epoch}:${scope.companyId}:${scope.branch}:${JSON.stringify(session.user)}`}
        >
          {children}
        </main>
      </div>
    </DriveCoreMotionProvider>
  );
}
