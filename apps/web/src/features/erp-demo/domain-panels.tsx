"use client";

import { useState } from "react";
import {
  ChevronRight,
  CreditCard,
  FileCheck2,
  PackageCheck,
  PenTool,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { allowed } from "@/lib/demo/permissions";
import { stock } from "@/lib/demo/rules";
import { label, money, rows } from "@/lib/demo/selectors";
import type { Database, DemoContext, Entity } from "@/lib/demo/types";
import {
  projectArAgeing,
  projectJournalBatches,
  projectRentalPipeline,
  projectVehicles,
  type VehicleProjection,
} from "./projections";
import { useDemo } from "./provider";
import { SignatureDialog } from "./signature-dialog";
import { Status } from "./table";

export function DomainShowcase({
  view,
  tab,
  ledgerMode,
  db,
  ctx,
  onNavigate,
  onOpenRecord,
  onOpen360,
}: {
  view: string;
  tab?: string;
  ledgerMode: boolean;
  db: Database;
  ctx: DemoContext;
  onNavigate: (values: Record<string, string>) => void;
  onOpenRecord: (entity: Entity) => void;
  onOpen360: (proj: VehicleProjection) => void;
}) {
  const { now, execute } = useDemo();
  const [sigOpen, setSigOpen] = useState(false);
  const [lastSignature, setLastSignature] = useState("");
  const [approvingId, setApprovingId] = useState("");

  if (view === "fleet" && tab === "vehicle") {
    const vehicles = projectVehicles(db, ctx, now).slice(0, 4);
    if (!vehicles.length) return null;
    return (
      <section
        aria-label="Fleet Asset ROI Highlights"
        className="dc-shadow-card rounded-2xl border bg-surface p-4"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
              Fleet Master ROI
            </p>
            <h2 className="text-sm font-extrabold">
              Vehicle Profitability & 360° Lifecycle Files
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Click 360° File on any asset for full P&L and disposal simulator
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {vehicles.map((p) => (
            <article
              key={p.vehicle.id}
              className="flex flex-col justify-between gap-2.5 rounded-2xl border bg-background/60 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="inline-block rounded-md bg-structural px-2 py-0.5 font-mono text-xs font-bold text-structural-foreground">
                    {p.vehicle.registration}
                  </span>
                  <p className="mt-1 truncate text-xs font-bold text-foreground">
                    {p.vehicle.make} {p.vehicle.model}
                  </p>
                </div>
                <Status value={p.status} />
              </div>
              <dl className="grid grid-cols-2 gap-2 border-t pt-2 text-[11px]">
                <div>
                  <dt className="text-muted-foreground">Revenue</dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {money(db, ctx.companyId, p.cumRevenue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Net ROI</dt>
                  <dd
                    className={`font-mono font-bold tabular-nums ${
                      p.netRoi >= 0 ? "text-success-foreground" : "text-danger-foreground"
                    }`}
                  >
                    {money(db, ctx.companyId, p.netRoi)}
                  </dd>
                </div>
              </dl>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 rounded-lg text-xs"
                  onClick={() => onOpenRecord(p.vehicle)}
                >
                  Open
                </Button>
                <Button
                  size="sm"
                  className="h-7 flex-1 rounded-lg text-xs"
                  onClick={() => onOpen360(p)}
                >
                  360° File
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (view === "rentals") {
    const stages = projectRentalPipeline(db, ctx);
    const pendingDiscounts = rows(db, ctx, "quotation").filter(
      (q) => q.status === "pending_approval",
    );
    const canApproveDiscount =
      allowed(db, ctx, "finance", true) ||
      allowed(db, ctx, "administration", true);
    return (
      <>
        <section
          aria-label="8-Step Commercial Rental Pipeline"
          className="dc-shadow-card rounded-2xl border bg-surface p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                Commercial Lifecycle Pipeline
              </p>
              <h2 className="text-sm font-extrabold">
                8-Step Quote-to-Cash Control Strip
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lastSignature ? (
                <span className="rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success-foreground">
                  Signed by {lastSignature}
                </span>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 rounded-xl"
                onClick={() => setSigOpen(true)}
              >
                <PenTool className="size-3.5 text-primary" aria-hidden="true" />
                Capture Digital Signature
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {stages.map((s) => (
              <button
                key={s.step}
                type="button"
                onClick={() => onNavigate({ tab: s.tab, id: "", page: "1" })}
                className={`group flex flex-col justify-between rounded-xl border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30 ${
                  tab === s.tab ? "border-primary/40 bg-accent/25" : "bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] font-bold text-primary">
                    0{s.step}
                  </span>
                  <ChevronRight
                    className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-1.5 text-xs font-bold leading-snug text-foreground">
                  {s.title}
                </p>
                <div className="mt-2 flex items-baseline justify-between gap-1 border-t pt-1.5">
                  <span className="font-mono text-base font-extrabold tabular-nums">
                    {s.count}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {s.note}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {pendingDiscounts.length > 0 ? (
            <div className="mt-4 space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-warning-foreground">
                  <ShieldAlert className="size-3.5" aria-hidden="true" />
                  Pending Discount Approvals ({pendingDiscounts.length})
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Quotations exceeding company threshold require approval before
                  conversion
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pendingDiscounts.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-muted/25 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        Quote #{q.id.slice(0, 8)} · {q.discountPct}% discount
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {money(db, ctx.companyId, q.total)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 rounded-lg text-xs"
                        onClick={() => onOpenRecord(q)}
                      >
                        View
                      </Button>
                      {canApproveDiscount ? (
                        <Button
                          size="sm"
                          className="h-7 rounded-lg text-xs"
                          disabled={approvingId === q.id}
                          onClick={async () => {
                            setApprovingId(q.id);
                            try {
                              await execute(ctx, {
                                type: "action",
                                id: q.id,
                                action: "approve_discount",
                                values: {},
                              });
                            } finally {
                              setApprovingId("");
                            }
                          }}
                        >
                          Approve
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        <SignatureDialog
          open={sigOpen}
          onOpenChange={setSigOpen}
          onCapture={(signedBy) => setLastSignature(signedBy)}
        />
      </>
    );
  }

  if (view === "customers" && allowed(db, ctx, "finance")) {
    const { exposures } = projectArAgeing(db, ctx, now);
    const flagged = exposures.slice(0, 4);
    if (!flagged.length) return null;
    return (
      <section
        aria-label="CRM Credit Control"
        className="dc-shadow-card rounded-2xl border bg-surface p-4"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
              CRM Credit Exposure
            </p>
            <h2 className="text-sm font-extrabold">
              Top Receivables & Credit Risk Accounts
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            Derived from scoped issued invoices
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {flagged.map((item) => (
            <button
              key={item.customer.id}
              type="button"
              onClick={() => onOpenRecord(item.customer)}
              className="flex flex-col justify-between gap-2 rounded-2xl border bg-background/60 p-3.5 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-xs font-extrabold text-foreground">
                  {item.customer.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                    item.holdRisk
                      ? "bg-danger/15 text-danger-foreground"
                      : "bg-success/15 text-success-foreground"
                  }`}
                >
                  {item.holdRisk ? "Review" : "Clear"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {item.customer.type === "corporate" ? "Corporate Account" : "Individual"} ·{" "}
                {item.overdueCount} overdue
              </p>
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="text-[11px] text-muted-foreground">Open AR</span>
                <span className="font-mono text-sm font-extrabold tabular-nums">
                  {money(db, ctx.companyId, item.outstanding)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (view === "maintenance") {
    const workOrders = rows(db, ctx, "workOrder").slice(0, 4);
    if (!workOrders.length) return null;
    return (
      <section
        aria-label="Workshop Queue Cards"
        className="dc-shadow-card rounded-2xl border bg-surface p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-extrabold">
            Active Workshop Bays & Service Authorisations
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {workOrders.map((wo) => {
            const v = db.entities.find((e) => e.id === wo.vehicleId);
            return (
              <button
                key={wo.id}
                type="button"
                onClick={() => onOpenRecord(wo)}
                className="flex flex-col justify-between gap-2 rounded-2xl border bg-background/60 p-3.5 text-left transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-structural px-2 py-0.5 font-mono text-[11px] font-bold text-structural-foreground">
                    {v && "registration" in v ? v.registration : wo.vehicleId}
                  </span>
                  <Status value={wo.status} />
                </div>
                <p className="line-clamp-2 text-xs font-bold text-foreground">
                  {wo.title}
                </p>
                <div className="flex justify-between border-t pt-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                  <span>Parts: {money(db, ctx.companyId, wo.partsCost)}</span>
                  <span>Labour: {money(db, ctx.companyId, wo.labourCost)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (view === "inventory") {
    const parts = rows(db, ctx, "part");
    const lowStock = parts.filter((p) => stock(db, p.id) <= p.minimum);
    if (!parts.length) return null;
    return (
      <section
        aria-label="Parts Stock Thresholds"
        className="dc-shadow-card rounded-2xl border bg-surface p-4"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PackageCheck className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-extrabold">
              Spare Parts Stock & Low-Stock Reorder Alerts
            </h2>
          </div>
          {lowStock.length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 font-mono text-xs font-bold text-danger-foreground">
              <ShieldAlert className="size-3.5" aria-hidden="true" />
              {lowStock.length} Low Stock SKU(s)
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {parts.slice(0, 5).map((p) => {
            const onHand = stock(db, p.id);
            const pct = Math.min(
              100,
              Math.round((onHand / Math.max(1, p.minimum * 2)) * 100),
            );
            const low = onHand <= p.minimum;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenRecord(p)}
                className="flex flex-col justify-between gap-2 rounded-2xl border bg-background/60 p-3 text-left transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">
                    {p.sku}
                  </span>
                  <span
                    className={`font-mono text-xs font-extrabold tabular-nums ${
                      low ? "text-danger-foreground" : "text-success-foreground"
                    }`}
                  >
                    {onHand} / min {p.minimum}
                  </span>
                </div>
                <p className="truncate text-xs font-bold text-foreground">
                  {p.name}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    style={{ width: `${pct}%` }}
                    className={low ? "h-full bg-primary" : "h-full bg-success"}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (view === "finance") {
    const { buckets } = projectArAgeing(db, ctx, now);
    const journalBatches = projectJournalBatches(db, ctx).slice(0, 4);
    return (
      <div className="space-y-4">
        <section
          aria-label="AR Ageing 5-Bucket Breakdown"
          className="dc-shadow-card rounded-2xl border bg-surface p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-extrabold">
                Accounts Receivable 5-Bucket Ageing Grid
              </h2>
            </div>
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">
              Issued Open Balances
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {buckets.map((b, i) => (
              <div
                key={b.key}
                className={`rounded-2xl border p-3.5 ${
                  i >= 2 && b.amount > 0
                    ? "border-primary/35 bg-accent/30"
                    : "bg-background/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    {b.label}
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
                    {b.count} inv
                  </span>
                </div>
                <p className="mt-2 font-mono text-base font-extrabold text-foreground tabular-nums">
                  {money(db, ctx.companyId, b.amount)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {(ledgerMode || journalBatches.length > 0) && (
          <section
            aria-label="Double-Entry General Ledger Stream"
            className="dc-shadow-card rounded-2xl border bg-surface p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                  Double-Entry GL Journal
                </p>
                <h2 className="text-sm font-extrabold">
                  Balanced Debit / Credit Postings
                </h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onNavigate({ ledger: ledgerMode ? "" : "1", id: "" })
                }
              >
                {ledgerMode ? "Back to finance tables" : "Open full ledger"}
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {journalBatches.map((batch) => (
                <article
                  key={batch.id}
                  className="rounded-2xl border bg-background/60 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 border-b pb-2">
                    <span className="truncate text-xs font-bold text-foreground">
                      {batch.reference}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(batch.date).toLocaleDateString()}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5 font-mono text-xs">
                    {batch.lines.map((line, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              line.debit > 0
                                ? "bg-structural text-structural-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {line.debit > 0 ? "DR" : "CR"}
                          </span>
                          <span className="truncate font-sans text-xs font-medium">
                            {line.account}
                          </span>
                        </span>
                        <span className="font-bold tabular-nums">
                          {money(
                            db,
                            ctx.companyId,
                            line.debit > 0 ? line.debit : line.credit,
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  if (view === "administration") {
    const pendingPOs = rows(db, ctx, "purchaseOrder").filter(
      (o) => o.status === "submitted",
    );
    const recentAudits = rows(db, ctx, "audit")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 4);
    const canApprove =
      allowed(db, ctx, "administration", true) ||
      allowed(db, ctx, "finance", true);

    return (
      <div className="grid gap-4 lg:grid-cols-12">
        <section className="dc-shadow-card rounded-2xl border bg-surface p-4 lg:col-span-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-extrabold">
                Pending Management Approvals
              </h2>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-link">
              {pendingPOs.length} pending
            </span>
          </div>
          {!pendingPOs.length ? (
            <p className="rounded-xl border bg-background/50 p-3 text-xs text-muted-foreground">
              All submitted procurement requests in this scope have been actioned.
            </p>
          ) : (
            <div className="space-y-2.5">
              {pendingPOs.map((po) => (
                <div
                  key={po.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{label(po)}</p>
                    <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      Qty {po.quantity} · {money(db, ctx.companyId, po.total)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenRecord(po)}
                    >
                      Inspect
                    </Button>
                    {canApprove ? (
                      <Button
                        size="sm"
                        disabled={approvingId === po.id}
                        onClick={async () => {
                          setApprovingId(po.id);
                          try {
                            await execute(ctx, {
                              type: "action",
                              id: po.id,
                              action: "approve",
                              values: {},
                            });
                          } finally {
                            setApprovingId("");
                          }
                        }}
                      >
                        Approve
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dc-shadow-card rounded-2xl border bg-surface p-4 lg:col-span-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold">
              Recent Immutable Audit Trail
            </h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate({ tab: "audit", id: "", page: "1" })}
            >
              View full log
            </Button>
          </div>
          <div className="space-y-2">
            {recentAudits.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenRecord(a)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background/60 p-2.5 text-left text-xs transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {a.description}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {a.action.toUpperCase()} ·{" "}
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold">
                  Audit
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return null;
}
