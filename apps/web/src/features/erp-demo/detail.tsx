"use client";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { allowed, kindModule } from "@/lib/demo/permissions";
import { related, label, money, displayStatus } from "@/lib/demo/selectors";
import { invoiceBalance, stock, actionBlockReason } from "@/lib/demo/rules";
import {
  entities,
  type Database,
  type DemoContext,
  type Entity,
} from "@/lib/demo/types";
import { actions, screens, fieldLabel, type WorkflowAction } from "./config";
import { cell, Status } from "./table";
import { isPrintableEntity, type PrintableEntity } from "./pdf-modal";
export function canManage(db: Database, ctx: DemoContext, e: Entity) {
  if (!allowed(db, ctx, kindModule[e.kind], true)) return false;
  if (
    ["company", "role"].includes(e.kind) &&
    !entities(db, "role")
      .find(
        (r) =>
          r.id ===
          entities(db, "user").find((u) => u.id === ctx.userId)?.roleId,
      )
      ?.permissions.includes("*")
  )
    return false;
  return true;
}
export function editable(e: Entity, db: Database) {
  return (
    !!screens[e.kind].fields &&
    (!("status" in e) ||
      ["draft", "open", "pending_approval"].includes(e.status)) &&
    !(e.kind === "vehicle" && displayStatus(db, e) === "rented") &&
    !["expense", "inspection", "message"].includes(e.kind)
  );
}
export function Detail({
  db,
  ctx,
  entity,
  onEdit,
  onAction,
  onDelete,
  onOpen,
  onOpen360,
  onGeneratePdf,
}: {
  db: Database;
  ctx: DemoContext;
  entity: Entity;
  onEdit: () => void;
  onAction: (action: WorkflowAction) => void;
  onDelete: () => void;
  onOpen: (e: Entity) => void;
  onOpen360?: (vehicle: Extract<Entity, { kind: "vehicle" }>) => void;
  onGeneratePdf?: (printable: PrintableEntity) => void;
}) {
  const linked = related(db, ctx, entity),
    ids = new Set([entity.id, ...linked.map((e) => e.id)]),
    timeline = entities(db, "audit")
      .filter((a) => ids.has(a.entityId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const extraFields =
    entity.kind === "quotation"
      ? ["discountAmount", "discountStatus", "discountApprovedBy", "vatRate"]
      : entity.kind === "reservation" ||
          entity.kind === "rental" ||
          entity.kind === "invoice"
        ? ["subtotal", "discountAmount", "vatRate", "vatAmount"]
        : [];
  const fields = [
    ...new Set([
      ...screens[entity.kind].columns,
      ...(screens[entity.kind].fields ?? []).map((f) => f.key),
      ...extraFields,
      "createdAt",
      "updatedAt",
    ]),
  ].filter((k) => !["permissions", "assignedBranchId"].includes(k));
  const manage = canManage(db, ctx, entity);
  const canApproveDiscount =
    entity.kind === "quotation" &&
    entity.status === "pending_approval" &&
    (allowed(db, ctx, "finance", true) ||
      allowed(db, ctx, "administration", true));
  const workflow = actions(entity).filter((a) => {
    if (["approve_discount", "reject_discount"].includes(a.action))
      return canApproveDiscount;
    if (a.action === "approve")
      return (
        allowed(db, ctx, "administration", true) ||
        allowed(db, ctx, "finance", true)
      );
    return manage;
  });
  const outstanding =
    entity.kind === "customer" && allowed(db, ctx, "finance")
      ? entities(db, "invoice")
          .filter((i) => i.customerId === entity.id)
          .reduce((n, i) => n + invoiceBalance(db, i.id).outstanding, 0)
      : null;
  function exportMetadata() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(entity, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "synthetic-document-metadata.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h2 className="break-words text-page-title font-extrabold tracking-tight">
            {label(entity)}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Status value={displayStatus(db, entity)} />
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              Demo record · {entity.id}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPrintableEntity(entity) && onGeneratePdf ? (
            <Button
              variant="default"
              className="gap-1.5"
              onClick={() => onGeneratePdf(entity)}
            >
              <FileText className="size-4" aria-hidden="true" />
              Generate PDF
            </Button>
          ) : null}
          {entity.kind === "vehicle" && onOpen360 ? (
            <Button variant="outline" onClick={() => onOpen360(entity)}>
              360° File
            </Button>
          ) : null}
          {manage && editable(entity, db) ? (
            <Button variant="outline" onClick={onEdit}>
              Edit record
            </Button>
          ) : null}
          {entity.kind === "document" ? (
            <Button variant="outline" onClick={exportMetadata}>
              Export metadata
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <section className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card xl:col-span-2">
          <h3 className="text-section-heading">Record information</h3>
          <dl className="grid gap-5 sm:grid-cols-2">
            {fields.map((key) => (
              <div key={key} className="min-w-0 space-y-1">
                <dt className="text-label text-muted-foreground">
                  {fieldLabel(key, entity.kind)}
                </dt>
                <dd className="break-words text-sm font-medium">
                  {cell(db, entity, key)}
                </dd>
              </div>
            ))}
          </dl>
          {entity.kind === "role" ? (
            <div className="space-y-2">
              <h4 className="text-card-heading">Capabilities</h4>
              <p className="break-words text-sm">
                {entity.permissions.join(", ") || "No capabilities"}
              </p>
            </div>
          ) : null}
        </section>
        <section className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card">
          <h3 className="text-section-heading">Workflow actions</h3>
          {workflow.length > 0 ? (
            <div className="flex flex-col items-start gap-3">
              {workflow.map((a) => (
                <div key={a.action} className="space-y-2">
                  <Button
                    key={a.action}
                    variant={a.action === "cancel" ? "outline" : "default"}
                    onClick={() => onAction(a)}
                    disabled={!!actionBlockReason(db, entity, a.action)}
                  >
                    {a.label}
                  </Button>
                  {actionBlockReason(db, entity, a.action) ? (
                    <p className="text-label text-muted-foreground">
                      {actionBlockReason(db, entity, a.action)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {manage || canApproveDiscount
                ? "No further transition is available in this state."
                : "Your demo role has read-only access to this record."}
            </p>
          )}
          {entity.kind === "part" ? (
            <p className="text-sm">
              Current stock: <strong>{stock(db, entity.id)}</strong>
            </p>
          ) : null}
          {entity.kind === "invoice" ? (
            <dl className="space-y-3 text-sm">
              {Object.entries(invoiceBalance(db, entity.id)).map(
                ([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="capitalize text-muted-foreground">{key}</dt>
                    <dd>{money(db, ctx.companyId, value)}</dd>
                  </div>
                ),
              )}
            </dl>
          ) : null}
          {outstanding !== null ? (
            <p className="text-sm">
              Customer outstanding:{" "}
              <strong>{money(db, ctx.companyId, outstanding)}</strong>
            </p>
          ) : null}
          {manage &&
          [
            "customer",
            "vehicle",
            "supplier",
            "part",
            "document",
            "setting",
            "quotation",
            "purchaseOrder",
          ].includes(entity.kind) &&
          !("status" in entity && entity.status !== "draft") ? (
            <Button variant="outline" onClick={onDelete}>
              Delete unlinked record
            </Button>
          ) : null}
          <p className="text-label text-muted-foreground">
            Prototype simulation. Linked history and posted transactions cannot
            be deleted.
          </p>
        </section>
      </div>
      <section className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card">
        <h3 className="text-section-heading">Related records & history</h3>
        {linked.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {linked
              .filter((e) => e.kind !== "audit")
              .map((e) => (
                <li key={e.id}>
                  <button
                    className="w-full rounded-control border p-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => onOpen(e)}
                  >
                    <span className="block text-label text-muted-foreground">
                      {screens[e.kind].label}
                    </span>
                    <span className="break-words font-medium">{label(e)}</span>
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No linked activity yet. New workflow changes will appear here.
          </p>
        )}
      </section>
      {allowed(db, ctx, "administration") ? (
        <section className="space-y-3 rounded-card border bg-surface p-card">
          <h3 className="text-section-heading">Activity timeline</h3>
          {timeline.length ? (
            <ol className="divide-y">
              {timeline.slice(0, 20).map((a) => (
                <li key={a.id} className="space-y-1 py-3">
                  <p className="text-sm font-medium">{a.description}</p>
                  <p className="text-label text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString()} ·{" "}
                    {cell(db, a, "actorId")}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              No audit events for this record yet.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
