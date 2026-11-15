"use client";
import Link from "next/link";
import { useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navigation } from "@/lib/navigation/definitions";
import { entities, type Database, type DemoContext } from "@/lib/demo/types";
import { allowed, companyOptions, branchOptions } from "@/lib/demo/permissions";
import { selectClass } from "./form";
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
export function Brand() {
  return (
    <span className="text-xl font-semibold">
      <span className="text-primary">D</span>riveCore
    </span>
  );
}
export function PrototypeShell({
  db,
  ctx,
  view,
  busy,
  dark,
  onNavigate,
  onReset,
  children,
}: {
  db: Database;
  ctx: DemoContext;
  view: string;
  busy: boolean;
  dark: boolean;
  onNavigate: (values: Record<string, string>) => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false);
  let companies: ReturnType<typeof companyOptions> = [],
    branches: ReturnType<typeof branchOptions> = [];
  try {
    companies = companyOptions(db, ctx.userId);
    branches = branchOptions(db, ctx);
  } catch {
    /* The content boundary explains invalid account/context URLs. */
  }
  function go(values: Record<string, string>) {
    onNavigate(values);
    setMobile(false);
  }
  function nav(inSheet = false) {
    return (
      <nav aria-label="Demo navigation" className="space-y-1 p-3">
        {navigation
          .filter((n) => allowed(db, ctx, n.key))
          .map((n) => {
            const Icon = icons[n.icon];
            return (
              <button
                key={n.key}
                disabled={busy}
                aria-label={n.label}
                aria-current={view === n.key ? "page" : undefined}
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
                className={`flex min-h-control w-full items-center gap-3 rounded-control px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${view === n.key ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className={collapsed && !inSheet ? "sr-only" : ""}>
                  {n.label}
                </span>
              </button>
            );
          })}
      </nav>
    );
  }
  return (
    <div data-erp-demo className="flex min-h-dvh bg-background">
      <a
        href="#erp-main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar lg:flex ${collapsed ? "w-sidebar-collapsed" : "w-sidebar"}`}
      >
        <div className="flex h-topbar items-center border-b px-6">
          {collapsed ? (
            <span className="text-xl font-semibold text-primary">D</span>
          ) : (
            <Brand />
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav()}</div>
        <Button
          variant="ghost"
          className="m-3"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && "Collapse navigation"}
        </Button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex min-h-topbar flex-wrap items-center justify-between gap-3 border-b bg-surface px-page py-2">
          <div className="flex items-center gap-3">
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
              <SheetContent side="left" className="w-sidebar">
                <SheetTitle>DriveCore demo</SheetTitle>
                <SheetDescription>
                  Allowed modules for the selected account
                </SheetDescription>
                {nav(true)}
              </SheetContent>
            </Sheet>
            <span className="lg:hidden">
              <Brand />
            </span>
            <span className="rounded-control border px-2 py-1 text-label font-semibold">
              DEMO MODE
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              onClick={() => go({ theme: dark ? "light" : "dark" })}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button variant="outline" disabled={busy} onClick={onReset}>
              Reset demo data
            </Button>
            <Link
              href="/companies"
              prefetch={false}
              className="text-sm text-link"
            >
              Exit demo
            </Link>
          </div>
        </header>
        <div className="grid gap-3 border-b bg-surface px-page py-3 sm:grid-cols-3">
          <label className="min-w-0 space-y-2 text-label">
            Demo account
            <select
              className={selectClass}
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
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="min-w-0 space-y-2 text-label">
            Company
            <select
              className={selectClass}
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 space-y-2 text-label">
            Branch
            <select
              className={selectClass}
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
              <option value="all">All accessible branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {children}
      </div>
    </div>
  );
}
