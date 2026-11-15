"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { LiveNavigation } from "./navigation";
import { WorkspaceHeader } from "./workspace-header";
import { hasWholeCompanyDirectory } from "@/features/setup/contracts";
import { errorText, initializeCsrf } from "@/lib/api/client";
import { useLiveContext } from "./context";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/layout/state-panel";
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
    <div className="flex w-full min-w-0 gap-2">
      <Select
        value={scope.companyId}
        onValueChange={(value) => {
          if (value) scope.navigate(`/companies/${value}/dashboard?branch=all`);
        }}
      >
        <SelectTrigger
          aria-label="Company"
          className="w-36 min-w-0 flex-1 xl:w-44"
        >
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
          className="w-36 min-w-0 flex-1 xl:w-48"
        >
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
function Account() {
  const session = useSession();
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="hidden max-w-40 truncate text-sm sm:inline"
        title={session.user?.name}
      >
        {session.user?.name}
      </span>
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await session.logout();
          } catch (failure) {
            setError(failure);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error ? (
        <div className="max-w-sm text-sm text-danger-foreground" role="alert">
          <p>{errorText(error)}</p>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await initializeCsrf();
                setError(
                  new Error("CSRF protection renewed. Try signing out again."),
                );
              } catch (failure) {
                setError(failure);
              }
            }}
          >
            Renew CSRF protection
          </Button>
        </div>
      ) : null}
    </div>
  );
}
export function LiveShell({ children }: { children: React.ReactNode }) {
  const scope = useLiveContext();
  const session = useSession();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
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
      <div className="min-h-dvh">
        <WorkspaceHeader />
        <main
          id="workspace-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-page py-8 outline-none sm:py-12"
        >
          {children}
        </main>
      </div>
    );
  if (scope.pending)
    return (
      <p role="status" className="p-page">
        Loading organization access…
      </p>
    );
  if (scope.error || !scope.company)
    return (
      <main className="space-y-6 p-page">
        <Account />
        <StatePanel
          title="Context unavailable"
          onRetry={scope.retry}
          href="/companies"
        >
          {scope.error?.message ?? "Select an accessible company."}
        </StatePanel>
      </main>
    );
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <aside
        data-testid="sidebar"
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar lg:flex ${collapsed ? "w-sidebar-collapsed" : "w-sidebar"}`}
      >
        <div className="flex h-topbar items-center border-b px-6 text-xl font-semibold">
          <span className="text-primary">D</span>
          {!collapsed && "riveCore"}
        </div>
        <div className="flex-1">
          <LiveNavigation collapsed={collapsed} />
        </div>
        <Button
          variant="ghost"
          aria-label="Toggle sidebar"
          className="m-3"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && "Collapse navigation"}
        </Button>
      </aside>
      <div className="min-w-0 flex-1">
        <header
          data-testid="topbar"
          className="sticky top-0 z-20 flex min-h-topbar items-center justify-between gap-3 border-b bg-surface px-page py-2"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="lg:hidden">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Open navigation"
                    />
                  }
                >
                  <Menu />
                </SheetTrigger>
                <SheetContent side="left" className="w-sidebar">
                  <SheetTitle>DriveCore</SheetTitle>
                  <SheetDescription>Company workspace</SheetDescription>
                  <LiveNavigation close={() => setOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>
            <span className="font-semibold lg:hidden">
              <span className="text-primary">D</span>riveCore
            </span>
            <div className="hidden xl:block">
              <Selectors />
            </div>
          </div>
          <Account />
        </header>
        <div className="border-b bg-surface px-page py-3 xl:hidden">
          <Selectors />
        </div>
        <div className="border-b px-page py-3 text-sm text-muted-foreground">
          <Link href="/companies" className="text-link">
            Companies
          </Link>{" "}
          / {scope.company.name} /{" "}
          {path.split("/").filter(Boolean).slice(2).join(" / ")}
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          className="space-y-6 p-page outline-none"
          key={`${session.epoch}:${scope.companyId}:${scope.branch}:${JSON.stringify(session.user)}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
