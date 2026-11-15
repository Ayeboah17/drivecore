"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  ClipboardList,
  CarFront,
  UsersRound,
  CalendarRange,
  Wrench,
  Package,
  Landmark,
  ShoppingCart,
  ChartNoAxesCombined,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DriveCoreLogo } from "@/components/brand/drivecore-mark";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navigation } from "@/lib/navigation/definitions";
import { DemoSetup, DemoDashboard, RecordList } from "./workspace-panels";
import { StepForm } from "./step-form";
import { steps } from "./steps";
import { useDemoStore } from "./store";

const icons = {
  dashboard: LayoutDashboard,
  operations: ClipboardList,
  fleet: CarFront,
  customers: UsersRound,
  rentals: CalendarRange,
  maintenance: Wrench,
  inventory: Package,
  finance: Landmark,
  procurement: ShoppingCart,
  reports: ChartNoAxesCombined,
  administration: Settings2,
};
const selectClass =
  "h-control min-w-0 rounded-control border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
function destination(
  company: string,
  branch = "all",
  view = "dashboard",
  fresh = false,
) {
  return `/demo/workflow?${new URLSearchParams({ company, branch, view, ...(fresh ? { new: "1" } : {}) })}`;
}
function go(url: string) {
  window.history.pushState(null, "", url);
}
function DemoLink({
  href,
  children,
  onNavigate,
  ...props
}: React.ComponentProps<"a"> & { href: string; onNavigate?: () => void }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(e) => {
        if (
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey &&
          !e.altKey &&
          e.button === 0
        ) {
          e.preventDefault();
          onNavigate?.();
          go(href);
        }
      }}
    >
      {children}
    </a>
  );
}
export function WorkflowDemo() {
  const store = useDemoStore();
  const params = useSearchParams();
  const [resetOpen, setResetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [formRevision, setFormRevision] = useState(0);
  const [recordForm, setRecordForm] = useState<2 | 3 | null>(null);
  const [recordBranch, setRecordBranch] = useState<string | null>(null);
  const [recordContext, setRecordContext] = useState<string>();
  const [writeError, setWriteError] = useState<string>();
  const main = useRef<HTMLElement>(null);
  const companies = store.data.records.filter((r) => r.kind === "company");
  const companyId = params.get("company") ?? companies[0]?.id;
  const company = companies.find((r) => r.id === companyId);
  const branches = store.data.records.filter(
    (r) => r.kind === "branch" && r.companyId === companyId,
  );
  const branch = params.get("branch") ?? "all";
  const validBranch = branch === "all" || branches.some((r) => r.id === branch);
  const fresh = params.get("new") === "1" || !companies.length;
  const view = params.get("view") ?? "dashboard";
  const setup = fresh || !branches.length || view === "setup";
  const scoped = store.data.records.filter(
    (r) =>
      r.companyId === companyId && (branch === "all" || r.branchId === branch),
  );
  const customers = scoped.filter((r) => r.kind === "customer");
  const vehicles = scoped.filter((r) => r.kind === "vehicle");
  useEffect(() => {
    const heading = main.current?.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [view, companyId, fresh, store.data.entered]);
  function openRecord(index: 2 | 3) {
    setFormError(undefined);
    setRecordBranch(branch === "all" ? (branches[0]?.id ?? null) : branch);
    setRecordContext(`${companyId}:${branch}`);
    setRecordForm(index);
  }
  function add(index: number, values: Record<string, string>) {
    setFormError(undefined);
    try {
      const id = crypto.randomUUID();
      const kind = (["company", "branch", "customer", "vehicle"] as const)[
        index
      ];
      const selectedBranch =
        recordBranch ?? (branch === "all" ? branches[0]?.id : branch);
      store.update((current) => {
        if (
          kind !== "company" &&
          !current.records.some(
            (r) => r.kind === "company" && r.id === companyId,
          )
        )
          throw new Error(
            "This company is no longer available. Select a company again.",
          );
        if (
          (kind === "customer" || kind === "vehicle") &&
          (!selectedBranch ||
            !current.records.some(
              (r) =>
                r.id === selectedBranch &&
                r.companyId === companyId &&
                r.kind === "branch",
            ))
        )
          throw new Error(
            "Select an available branch before creating a record.",
          );
        const normalized =
          kind === "vehicle"
            ? { ...values, registration: values.registration.toUpperCase() }
            : values;
        if (
          kind === "branch" &&
          current.records.some(
            (r) =>
              r.kind === kind &&
              r.companyId === companyId &&
              r.values.name === values.name,
          )
        )
          throw new Error(
            "A branch with this name already exists in this demo company.",
          );
        if (
          kind === "vehicle" &&
          current.records.some(
            (r) =>
              r.kind === kind &&
              r.companyId === companyId &&
              r.values.registration === normalized.registration,
          )
        )
          throw new Error(
            "This registration already exists in this demo company.",
          );
        return {
          ...current,
          records: [
            ...current.records,
            {
              id,
              kind,
              companyId: kind === "company" ? id : companyId!,
              ...(kind === "customer" || kind === "vehicle"
                ? { branchId: selectedBranch }
                : {}),
              values: normalized,
            },
          ],
        };
      });
      setFormRevision((n) => n + 1);
      setRecordForm(null);
      if (kind === "company") go(destination(id, "all", "setup"));
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not save demo data. Check available browser storage and try again.",
      );
    }
  }
  const resetDialog = (
    <Dialog open={resetOpen} onOpenChange={setResetOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset demo?</DialogTitle>
          <DialogDescription>
            This removes all demo companies, branches, customers and vehicles
            saved in this browser. Live records are unaffected.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setResetOpen(false)}>
            Keep demo
          </Button>
          <Button
            onClick={() => {
              try {
                store.reset();
                setResetOpen(false);
                setRecordForm(null);
                setFormError(undefined);
                setWriteError(undefined);
                go("/demo/workflow");
              } catch {
                setWriteError(
                  "Browser storage could not be cleared. Enable storage and try again.",
                );
              }
            }}
          >
            Reset demo records
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  const brand = (
    <Link
      href="/companies"
      prefetch={false}
      className="rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
    >
      <DriveCoreLogo badge="DEMO" />
    </Link>
  );
  const banner = (
    <div className="border-b bg-surface px-page py-3 text-sm">
      <strong>Workflow demo</strong>
      <span className="ml-3 text-muted-foreground">
        Fictional data only. Saved in this browser until you reset. No live
        records are created.
      </span>
    </div>
  );
  if (store.loading)
    return (
      <p role="status" className="p-page">
        Loading demo workspace…
      </p>
    );
  if (store.error || !store.data.entered)
    return (
      <div className="min-h-dvh bg-background">
        <header className="flex h-topbar items-center justify-between border-b bg-surface px-page">
          {brand}
          <Link href="/login" prefetch={false} className="text-sm text-link">
            Live sign-in
          </Link>
        </header>
        <main className="mx-auto max-w-lg space-y-6 px-page py-12">
          <h1 className="text-page-title">Explore DriveCore</h1>
          <Link
            href="/demo/erp"
            prefetch={false}
            className="inline-block text-sm font-medium text-link"
          >
            Explore the full interactive ERP demo
          </Link>
          <p className="text-sm text-muted-foreground">
            Enter as Demo administrator. Set up a company and branches, then
            explore customers and vehicles in your own demo workspace.
          </p>
          <section className="space-y-5 rounded-card border bg-surface p-card">
            <h2 className="text-section-heading">Demo workspace</h2>
            <p className="text-sm text-muted-foreground">
              No email or password required. Use fictional details only. Your
              demo stays in this browser and never connects to live records.
            </p>
            {store.error ? (
              <p role="alert" className="text-sm text-danger-foreground">
                {store.error}
              </p>
            ) : (
              <Button
                onClick={() => {
                  try {
                    store.update((s) => ({ ...s, entered: true }));
                  } catch {
                    setWriteError(
                      "Demo storage is unavailable. Enable browser storage and try again.",
                    );
                  }
                }}
              >
                Enter demo
              </Button>
            )}
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              Reset demo
            </Button>
          </section>
          {writeError ? <p role="alert">{writeError}</p> : null}
        </main>
        {resetDialog}
      </div>
    );
  function nav(close?: () => void) {
    return (
      <nav aria-label="Main navigation" className="space-y-1 p-3">
        {navigation.map((item) => {
          const Icon = icons[item.icon];
          return (
            <DemoLink
              key={item.key}
              href={destination(companyId ?? "", branch, item.key)}
              aria-label={item.label}
              aria-current={view === item.key && !setup ? "page" : undefined}
              onNavigate={close}
              className={`flex min-h-control items-center justify-between gap-2 rounded-control px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring ${view === item.key && !setup ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
            >
              <span className="flex items-center gap-3">
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={collapsed && !close ? "sr-only" : undefined}>
                  {item.label}
                </span>
              </span>
              {!["dashboard", "customers", "fleet"].includes(item.key) &&
              (!collapsed || close) ? (
                <span className="rounded border px-1 text-[10px] text-muted-foreground">
                  Planned
                </span>
              ) : null}
            </DemoLink>
          );
        })}
      </nav>
    );
  }
  const contextError = !fresh && (!company || !validBranch);
  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#demo-main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar lg:flex ${collapsed ? "w-sidebar-collapsed" : "w-sidebar"}`}
      >
        <div className="flex h-topbar items-center border-b px-4">
          {collapsed ? (
            <DriveCoreLogo collapsed />
          ) : (
            brand
          )}
        </div>
        <div className="flex-1">{nav()}</div>
        <Button
          variant="ghost"
          className="m-3"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && "Collapse navigation"}
        </Button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex min-h-topbar flex-wrap items-center justify-between gap-3 border-b bg-surface px-page py-3">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open navigation"
                    className="lg:hidden"
                  />
                }
              >
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="w-sidebar">
                <SheetTitle>DriveCore demo</SheetTitle>
                <SheetDescription>Demo workspace navigation</SheetDescription>
                {nav(() => setMobileOpen(false))}
              </SheetContent>
            </Sheet>
            <span className="lg:hidden">{brand}</span>
            <span className="hidden text-sm font-medium sm:inline">
              Demo administrator
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              Reset demo
            </Button>
            <Link
              href="/companies"
              prefetch={false}
              className="self-center text-sm text-link"
            >
              Exit demo
            </Link>
          </div>
        </header>
        {banner}
        <main
          ref={main}
          id="demo-main"
          tabIndex={-1}
          className="space-y-6 p-page outline-none"
        >
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-label sm:flex-none">
              Company
              <select
                className={selectClass}
                value={company?.id ?? ""}
                onChange={(e) => {
                  setRecordForm(null);
                  setFormError(undefined);
                  go(destination(e.target.value));
                }}
              >
                <option value="" disabled>
                  Select company
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.values.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-label sm:flex-none">
              Branch scope
              <select
                className={selectClass}
                value={branch}
                onChange={(e) => {
                  setRecordForm(null);
                  setFormError(undefined);
                  go(destination(companyId!, e.target.value, view));
                }}
              >
                <option value="all">All branches in this company</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.values.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {writeError ? (
            <p role="alert" className="text-sm text-danger-foreground">
              {writeError}
            </p>
          ) : null}
          {contextError ? (
            <section className="space-y-3 rounded-card border bg-surface p-card">
              <h1 className="text-page-title">Demo context unavailable</h1>
              <p className="text-sm">
                Select an existing company and branch. The requested context is
                no longer available.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  go(
                    destination(
                      companies[0]?.id ?? "",
                      "all",
                      "setup",
                      !companies.length,
                    ),
                  )
                }
              >
                Return to setup
              </Button>
            </section>
          ) : setup ? (
            <DemoSetup
              fresh={fresh}
              company={company}
              companyId={companyId}
              branches={branches}
              revision={formRevision}
              error={formError}
              onCreate={add}
              onOpen={() => go(destination(companyId!))}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-page-title">
                    {view === "dashboard"
                      ? "Dashboard"
                      : view === "customers"
                        ? "Customers"
                        : view === "fleet"
                          ? "Fleet"
                          : (navigation.find((n) => n.key === view)?.label ??
                            "Module")}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {company?.values.name} ·{" "}
                    {branch === "all"
                      ? "All branches"
                      : branches.find((b) => b.id === branch)?.values.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormError(undefined);
                      go(destination(companyId!, "all", "setup", true));
                    }}
                  >
                    Create company
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormError(undefined);
                      go(destination(companyId!, "all", "setup"));
                    }}
                  >
                    Create branch
                  </Button>
                </div>
              </div>
              {view === "dashboard" ? (
                <DemoDashboard
                  branchCount={branches.length}
                  customerCount={customers.length}
                  vehicleCount={vehicles.length}
                  onCreate={openRecord}
                />
              ) : view === "customers" || view === "fleet" ? (
                <section className="space-y-5 rounded-card border bg-surface p-card">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-section-heading">
                      Demo {view === "customers" ? "customers" : "vehicles"}
                    </h2>
                    <Button
                      onClick={() => {
                        openRecord(view === "customers" ? 2 : 3);
                      }}
                    >
                      Create {view === "customers" ? "customer" : "vehicle"}
                    </Button>
                  </div>
                  <RecordList
                    records={view === "customers" ? customers : vehicles}
                    branches={branches}
                  />
                </section>
              ) : (
                <section className="space-y-2 rounded-card border bg-surface p-card">
                  <h2 className="text-section-heading">Planned module</h2>
                  <p className="text-sm text-muted-foreground">
                    This module is outside the demo workflow. Explore Dashboard,
                    Customers or Fleet.
                  </p>
                </section>
              )}
            </>
          )}
        </main>
      </div>
      {resetDialog}
      <Dialog
        open={
          recordForm !== null &&
          !setup &&
          !contextError &&
          recordContext === `${companyId}:${branch}`
        }
        onOpenChange={(open) => {
          if (!open) setRecordForm(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {recordForm === 2
                ? "Create demo customer"
                : "Create demo vehicle"}
            </DialogTitle>
            <DialogDescription>
              Use fictional details only. Select the branch that owns this
              record.
            </DialogDescription>
          </DialogHeader>
          {recordForm !== null ? (
            <>
              <label className="flex flex-col gap-2 text-sm">
                Record branch
                <select
                  className={selectClass}
                  value={recordBranch ?? ""}
                  onChange={(e) => {
                    setRecordBranch(e.target.value);
                  }}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.values.name}
                    </option>
                  ))}
                </select>
              </label>
              <StepForm
                key={`${recordForm}-${companyId}`}
                definition={steps[recordForm]}
                error={formError}
                onComplete={(v) => add(recordForm, v)}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
