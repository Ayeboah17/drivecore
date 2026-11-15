"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import {
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
  Menu,
  Sun,
  Moon,
  Bell,
  MapPin,
  BarChart3,
  RotateCcw,
  ShieldCheck,
  Building2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DriveCoreLogo } from "@/components/brand/drivecore-mark";
import { navigation } from "@/lib/navigation/definitions";
import { entities, type Database, type DemoContext, type Entity } from "@/lib/demo/types";
import {
  allowed,
  companyOptions,
  branchOptions,
} from "@/lib/demo/permissions";
import { label, rows, type Range } from "@/lib/demo/selectors";
import { KpiScorecardModal } from "./kpi-modal";
import { useDemo } from "./provider";

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

export function Brand({ subtitle }: { subtitle?: string }) {
  return <DriveCoreLogo badge="ERP v1.0" subtitle={subtitle} />;
}

export function PrototypeShell({
  db,
  ctx,
  view,
  range,
  busy,
  dark,
  onNavigate,
  onOpenRecord,
  onReset,
  children,
}: {
  db: Database;
  ctx: DemoContext;
  view: string;
  range: Range;
  busy: boolean;
  dark: boolean;
  onNavigate: (values: Record<string, string>) => void;
  onOpenRecord?: (entity: Entity) => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const { execute, now } = useDemo();
  const [mobile, setMobile] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);

  let companies: ReturnType<typeof companyOptions> = [];
  let branches: ReturnType<typeof branchOptions> = [];
  let notifications: ReturnType<typeof rows<"notification">> = [];
  let contextValid = true;
  try {
    companies = companyOptions(db, ctx.userId);
    branches = branchOptions(db, ctx);
    notifications = rows(db, ctx, "notification").sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  } catch {
    contextValid = false;
  }

  const unreadNotifications = notifications.filter((n) => !n.read);
  const activeUser = entities(db, "user").find((u) => u.id === ctx.userId);
  const activeParts = (activeUser?.name ?? "DU").trim().split(/\s+/);
  const initials =
    activeParts.length > 1
      ? `${activeParts[0][0]}${activeParts[activeParts.length - 1][0]}`.toUpperCase()
      : (activeParts[0]?.slice(0, 2) ?? "DU").toUpperCase();

  let pendingCount = 0;
  if (contextValid) {
    try {
      pendingCount = rows(db, ctx, "purchaseOrder").filter(
        (po) => po.status === "submitted",
      ).length;
    } catch {
      pendingCount = 0;
    }
  }

  function go(values: Record<string, string>) {
    onNavigate(values);
    setMobile(false);
  }

  function navButton(n: (typeof navigation)[number], inSheet = false) {
    const Icon = icons[n.icon];
    const active = view === n.key;
    const badgeCount =
      n.key === "procurement" && pendingCount > 0 ? pendingCount : 0;

    if (inSheet) {
      return (
        <button
          key={n.key}
          disabled={busy}
          aria-label={n.label}
          aria-current={active ? "page" : undefined}
          onClick={() =>
            go({
              view: n.key,
              tab: "",
              id: "",
              q: "",
              filter: "",
              page: "1",
            })
          }
          className={`flex min-h-control w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${
            active
              ? "bg-accent text-accent-foreground"
              : "text-foreground hover:bg-muted"
          }`}
        >
          <span className="flex items-center gap-3">
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{n.label}</span>
          </span>
          {badgeCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">
              {badgeCount}
            </span>
          ) : null}
        </button>
      );
    }

    return (
      <button
        key={n.key}
        disabled={busy}
        aria-label={n.label}
        aria-current={active ? "page" : undefined}
        onClick={() =>
          go({
            view: n.key,
            tab: "",
            id: "",
            q: "",
            filter: "",
            page: "1",
          })
        }
        className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {active ? (
          <motion.span
            layoutId="erp-demo-nav-pill"
            transition={{ type: "spring", duration: 0.35, bounce: 0.14 }}
            className="absolute inset-0 rounded-lg border bg-surface shadow-xs"
            aria-hidden="true"
          />
        ) : null}
        <span className="relative z-10 inline-flex items-center gap-1.5">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{n.label}</span>
          {badgeCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] leading-none font-bold text-primary-foreground">
              {badgeCount}
            </span>
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <div
      data-erp-demo
      className="flex min-h-dvh flex-col bg-background selection:bg-primary selection:text-primary-foreground"
    >
      <a
        href="#erp-main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:rounded-control focus:bg-surface focus:p-3 focus:outline-2 focus:outline-ring"
      >
        Skip to content
      </a>

      {/* STICKY FLOATING GLASSMORPHIC HEADER */}
      <header className="sticky top-0 z-40 px-3 pt-2.5 pb-1.5">
        <div className="dc-glass-panel dc-shadow-float mx-auto max-w-[1600px] rounded-2xl border px-3.5 py-2.5">
          {/* Top Row: Brand, Inline Company/Branch Selectors & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <Sheet open={mobile} onOpenChange={setMobile}>
                <SheetTrigger
                  render={
                    <Button
                      className="lg:hidden"
                      variant="ghost"
                      size="icon"
                      aria-label="Open demo navigation"
                    />
                  }
                >
                  <Menu />
                </SheetTrigger>
                <SheetContent side="left" className="w-72">
                  <SheetTitle>DriveCore ERP</SheetTitle>
                  <SheetDescription>
                    Modules available to your selected demo role
                  </SheetDescription>
                  <nav aria-label="Demo mobile navigation" className="mt-4 space-y-1">
                    {navigation
                      .filter((n) => allowed(db, ctx, n.key))
                      .map((n) => navButton(n, true))}
                  </nav>
                </SheetContent>
              </Sheet>

              <Link
                href="/demo/erp?demo=1"
                onClick={(e) => {
                  e.preventDefault();
                  go({ view: "dashboard", tab: "", id: "", q: "", filter: "", page: "1" });
                }}
                className="rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Brand subtitle="Fleet · Maintenance · Finance" />
              </Link>

              <span className="hidden rounded-lg border bg-muted/70 px-2 py-1 font-mono text-[10px] font-semibold tracking-wider text-muted-foreground sm:inline-block">
                DEMO MODE
              </span>
            </div>

            {/* Center Context Cluster (Company + Branch) */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-surface px-2.5 text-xs font-medium text-muted-foreground shadow-2xs">
                <Building2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="sr-only">Company</span>
                <select
                  aria-label="Company"
                  className="max-w-40 bg-transparent text-xs font-semibold text-foreground focus:outline-none"
                  value={ctx.companyId}
                  disabled={busy}
                  onChange={(e) =>
                    go({
                      company: e.target.value,
                      branch: "all",
                      view: "dashboard",
                      tab: "",
                      id: "",
                      q: "",
                      filter: "",
                      page: "1",
                    })
                  }
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id} className="bg-surface text-foreground">
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-surface px-2.5 text-xs font-medium text-muted-foreground shadow-2xs">
                <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="sr-only">Branch</span>
                <select
                  aria-label="Branch"
                  className="max-w-44 bg-transparent text-xs font-semibold text-foreground focus:outline-none"
                  value={ctx.branchId}
                  disabled={busy}
                  onChange={(e) =>
                    go({
                      branch: e.target.value,
                      id: "",
                      q: "",
                      filter: "",
                      page: "1",
                    })
                  }
                >
                  <option value="all" className="bg-surface text-foreground">
                    All accessible branches
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-surface text-foreground">
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Right Control Cluster */}
            <div className="flex flex-wrap items-center gap-2">
              {contextValid ? (
                <button
                  type="button"
                  onClick={() => setKpiOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-success/40 bg-success/10 px-3 text-xs font-bold text-success-foreground transition-colors hover:bg-success/20 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <BarChart3 className="size-3.5" aria-hidden="true" />
                  <span>9 KPIs</span>
                </button>
              ) : null}

              {/* Dark Charcoal Role Switcher Pill */}
              <label className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-structural px-2.5 text-xs font-semibold text-structural-foreground shadow-xs">
                <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="sr-only">Demo account</span>
                <select
                  aria-label="Demo account"
                  className="max-w-40 bg-transparent text-xs font-semibold text-structural-foreground focus:outline-none"
                  value={ctx.userId}
                  disabled={busy}
                  onChange={(e) => {
                    const available = companyOptions(db, e.target.value);
                    go({
                      user: e.target.value,
                      company:
                        available.find((c) => c.id === ctx.companyId)?.id ??
                        available[0]?.id ??
                        "",
                      branch: "all",
                      view: "dashboard",
                      tab: "",
                      id: "",
                      q: "",
                      filter: "",
                      page: "1",
                    });
                  }}
                >
                  {entities(db, "user")
                    .filter((u) => u.active)
                    .map((u) => (
                      <option key={u.id} value={u.id} className="bg-structural text-structural-foreground">
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>

              {/* Notifications Slide-Over Drawer Trigger */}
              <Sheet open={alertsOpen} onOpenChange={setAlertsOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Notifications (${unreadNotifications.length} unread)`}
                      className="relative size-9 rounded-xl"
                    />
                  }
                >
                  <Bell className="size-4" aria-hidden="true" />
                  {unreadNotifications.length > 0 ? (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">
                      {unreadNotifications.length}
                    </span>
                  ) : null}
                </SheetTrigger>
                <SheetContent side="right" className="w-80 sm:w-96">
                  <SheetTitle>System Alerts & Notifications</SheetTitle>
                  <SheetDescription>
                    Events generated by demo commands in your active scope
                  </SheetDescription>
                  <div className="mt-4 space-y-2.5 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                        No alerts recorded in the active company and branch
                        scope.
                      </p>
                    ) : (
                      notifications.slice(0, 15).map((n) => {
                        const related = db.entities.find(
                          (e) => e.id === n.entityId,
                        );
                        return (
                          <div
                            key={n.id}
                            className={`space-y-2 rounded-xl border p-3 text-sm ${
                              n.read
                                ? "bg-surface/60 opacity-80"
                                : "border-primary/30 bg-accent/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-foreground">
                                {n.title}
                              </p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                                  n.read
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-primary text-primary-foreground"
                                }`}
                              >
                                {n.read ? "Read" : "Unread"}
                              </span>
                            </div>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {related ? label(related) : n.entityId} ·{" "}
                              {new Date(n.createdAt).toLocaleString()}
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {related && onOpenRecord ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    onOpenRecord(related);
                                    setAlertsOpen(false);
                                  }}
                                >
                                  Open record
                                </Button>
                              ) : null}
                              {!n.read ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    void execute(ctx, {
                                      type: "action",
                                      id: n.id,
                                      action: "read",
                                      values: {},
                                    });
                                  }}
                                >
                                  <Check className="mr-1 size-3.5" aria-hidden="true" />
                                  Mark read
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </SheetContent>
              </Sheet>

              <Button
                size="icon"
                variant="outline"
                className="size-9 rounded-xl"
                aria-label={dark ? "Use light theme" : "Use dark theme"}
                onClick={() => go({ theme: dark ? "light" : "dark" })}
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xl"
                disabled={busy}
                onClick={onReset}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span>Reset demo data</span>
              </Button>

              <span
                aria-hidden="true"
                className="hidden size-9 items-center justify-center rounded-xl bg-structural font-mono text-xs font-bold text-structural-foreground sm:inline-flex"
                title={activeUser?.name}
              >
                {initials}
              </span>

              <Link
                href="/companies"
                prefetch={false}
                className="px-1 text-xs font-semibold text-link hover:text-link-hover hover:underline"
              >
                Exit demo
              </Link>
            </div>
          </div>

          {/* Desktop Horizontal Pill Navigation (11 DriveCore Modules) */}
          <div className="mt-2.5 hidden border-t pt-2 lg:block">
            <nav
              aria-label="Demo navigation"
              className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/80 p-1"
            >
              {navigation
                .filter((n) => allowed(db, ctx, n.key))
                .map((n) => navButton(n, false))}
            </nav>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] flex-1">{children}</div>

      {contextValid ? (
        <KpiScorecardModal
          open={kpiOpen}
          onOpenChange={setKpiOpen}
          db={db}
          ctx={ctx}
          range={range}
          now={now}
        />
      ) : null}
    </div>
  );
}
