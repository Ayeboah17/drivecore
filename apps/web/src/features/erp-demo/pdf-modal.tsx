"use client";

import { useState } from "react";
import { Download, FileText, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreLogo } from "@/components/brand/drivecore-mark";
import { entities, find, type Database, type Entity } from "@/lib/demo/types";
import { displayStatus, label, money } from "@/lib/demo/selectors";

export type PrintableEntity = Extract<
  Entity,
  { kind: "quotation" | "reservation" | "rental" | "invoice" }
>;

export function isPrintableEntity(e: Entity): e is PrintableEntity {
  return ["quotation", "reservation", "rental", "invoice"].includes(e.kind);
}

function escapePdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** Generate a valid minimal single-page PDF-1.4 document completely client-side. */
export function buildDriveCorePdfBlob(lines: string[]): Blob {
  const safeLines = lines.slice(0, 42);
  const contentCommands = [
    "BT",
    "/F2 16 Tf",
    "48 760 Td",
    `(${escapePdfText(safeLines[0] ?? "DriveCore Solutions Document")}) Tj`,
    "/F1 10 Tf",
    "0 -22 Td",
  ];
  for (let i = 1; i < safeLines.length; i++) {
    contentCommands.push(`(${escapePdfText(safeLines[i])}) Tj`);
    contentCommands.push("0 -15 Td");
  }
  contentCommands.push("ET");
  const stream = contentCommands.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function DocumentPdfModal({
  db,
  entity,
  onClose,
}: {
  db: Database;
  entity: PrintableEntity | null;
  onClose: () => void;
}) {
  const [downloaded, setDownloaded] = useState(false);

  if (!entity) {
    return (
      <Dialog open={false} onOpenChange={onClose}>
        <DialogContent />
      </Dialog>
    );
  }

  const company = entities(db, "company").find(
    (c) => c.id === entity.companyId,
  );
  const branch = entities(db, "branch").find((b) => b.id === entity.branchId);
  const customer = find(db, "customer", entity.customerId);
  const vehicleIds =
    entity.kind === "quotation" && entity.vehicleIds.length
      ? entity.vehicleIds
      : "vehicleId" in entity
        ? [entity.vehicleId]
        : [];
  const vehicles = vehicleIds
    .map((vId) => entities(db, "vehicle").find((v) => v.id === vId))
    .filter((v): v is NonNullable<typeof v> => !!v);

  const subtotal =
    entity.subtotal > 0
      ? entity.subtotal
      : Math.max(0, entity.total - entity.vatAmount + entity.discountAmount);
  const fmt = (minor: number) => money(db, entity.companyId, minor);
  const docTitle =
    entity.kind === "quotation"
      ? "OFFICIAL QUOTATION"
      : entity.kind === "invoice"
        ? "TAX INVOICE"
        : entity.kind === "reservation"
          ? "RESERVATION CONFIRMATION"
          : "RENTAL AGREEMENT";

  function handleDownloadPdf() {
    const lines: string[] = [
      `DRIVECORE ERP - ${docTitle}`,
      `Company: ${company?.name ?? entity!.companyId} | Branch: ${branch?.name ?? entity!.branchId}`,
      `Document ID: ${entity!.id} | Status: ${displayStatus(db, entity!).toUpperCase()}`,
      `Date: ${new Date(entity!.createdAt).toLocaleString()}`,
      "---------------------------------------------------------------------",
      `Customer: ${customer.name} (${customer.type})`,
      `Contact: ${customer.email || "-"} | ${customer.phone || "-"}`,
      "---------------------------------------------------------------------",
    ];
    if (vehicles.length > 0) {
      lines.push("Selected Vehicles:");
      for (const v of vehicles) {
        lines.push(
          `  - ${v.registration} | ${v.make} ${v.model} (${v.category}) | ${fmt(v.dailyRate)}/day`,
        );
      }
    } else if ("description" in entity!) {
      lines.push(`Description: ${entity!.description}`);
    }
    if ("startsAt" in entity!) {
      lines.push(
        `Period: ${new Date(entity!.startsAt).toLocaleString()} -> ${new Date(entity!.endsAt).toLocaleString()}`,
      );
    }
    lines.push(
      "---------------------------------------------------------------------",
      `Subtotal:        ${fmt(subtotal)}`,
      `Discount:       -${fmt(entity!.discountAmount)}${entity!.kind === "quotation" && entity!.discountPct ? ` (${entity!.discountPct}%)` : ""}`,
      `VAT (${entity!.vatRate}%):      ${fmt(entity!.vatAmount)}`,
      `TOTAL DUE:       ${fmt(entity!.total)}`,
      "---------------------------------------------------------------------",
      "Generated by DriveCore ERP Demo Prototype (Non-production simulation).",
    );
    const blob = buildDriveCorePdfBlob(lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drivecore-${entity!.kind}-${entity!.id.slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  return (
    <Dialog
      open={!!entity}
      onOpenChange={(open) => {
        if (!open) {
          setDownloaded(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-2xl">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-link" aria-hidden="true" />
            {docTitle}
          </DialogTitle>
          <DialogDescription>
            Preview itemized financial breakdown, VAT, and discount status, then
            download `.pdf` or print.
          </DialogDescription>
        </DialogHeader>

        {/* PRINTABLE / PREVIEW DOCUMENT SHEET */}
        <div className="space-y-5 rounded-2xl border bg-surface p-6 text-sm shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div className="space-y-1">
              <DriveCoreLogo
                badge={entity.kind.toUpperCase()}
                subtitle={company?.name ?? "DriveCore Solutions"}
              />
              <p className="pt-1 text-xs text-muted-foreground">
                Branch: {branch?.name ?? entity.branchId}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-link">
                {docTitle}
              </p>
              <p className="mt-1 font-mono text-xs font-semibold">
                #{entity.id.slice(0, 14)}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(entity.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid gap-4 rounded-xl border bg-muted/30 p-3.5 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Billed To
              </p>
              <p className="mt-1 font-semibold">{customer.name}</p>
              <p className="text-xs text-muted-foreground">
                {customer.email || "No email"} · {customer.phone || "No phone"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Document Status
              </p>
              <p className="mt-1 font-mono text-xs font-bold uppercase">
                {displayStatus(db, entity).replaceAll("_", " ")}
              </p>
              {entity.kind === "quotation" && entity.discountPct > 0 ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-link" aria-hidden="true" />
                  Discount {entity.discountPct}% ({entity.discountStatus}
                  {entity.discountApprovedBy
                    ? ` by ${entity.discountApprovedBy}`
                    : ""}
                  )
                </p>
              ) : null}
            </div>
          </div>

          {vehicles.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="bg-structural text-structural-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Registration</th>
                    <th className="px-3 py-2.5 font-semibold">Vehicle</th>
                    <th className="px-3 py-2.5 font-semibold">Category</th>
                    <th className="px-3 py-2.5 text-right font-semibold">
                      Daily Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2.5 font-mono font-bold">
                        {v.registration}
                      </td>
                      <td className="px-3 py-2.5">
                        {v.make} {v.model} ({v.year})
                      </td>
                      <td className="px-3 py-2.5">{v.category}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {fmt(v.dailyRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : "description" in entity ? (
            <div className="rounded-xl border p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Line Description
              </p>
              <p className="mt-1 font-medium">{entity.description}</p>
            </div>
          ) : null}

          {"startsAt" in entity ? (
            <p className="font-mono text-xs text-muted-foreground">
              Schedule: {new Date(entity.startsAt).toLocaleString()} —{" "}
              {new Date(entity.endsAt).toLocaleString()}
            </p>
          ) : null}

          {/* Totals Breakdown Box */}
          <div className="ml-auto max-w-xs space-y-2 rounded-xl border bg-muted/25 p-4 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Discount
                {entity.kind === "quotation" && entity.discountPct
                  ? ` (${entity.discountPct}%)`
                  : ""}
              </span>
              <span className="text-link tabular-nums">
                -{fmt(entity.discountAmount)}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">
                VAT ({entity.vatRate}%)
              </span>
              <span className="tabular-nums">{fmt(entity.vatAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-foreground">
              <span>Grand Total</span>
              <span className="tabular-nums">{fmt(entity.total)}</span>
            </div>
          </div>

          <p className="border-t pt-3 text-[11px] text-muted-foreground">
            Demo Reference: {label(entity)} · Client-side synthetic document
            simulation.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 print:hidden">
          <span className="text-xs text-muted-foreground">
            {downloaded
              ? "PDF file downloaded."
              : "Includes multi-vehicle schedule, discount, and VAT lines."}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" aria-hidden="true" />
              Print
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 rounded-xl"
              onClick={handleDownloadPdf}
            >
              <Download className="size-3.5" aria-hidden="true" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
