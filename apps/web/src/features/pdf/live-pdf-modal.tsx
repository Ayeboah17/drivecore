"use client";

import { useState } from "react";
import { Download, FileText, Printer, Server } from "lucide-react";
import { DriveCoreLogo } from "@/components/brand/drivecore-mark";
import { StatusDotBadge } from "@/components/data/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoneyMinor } from "@/lib/api/contracts";

export interface LivePdfLineItem {
  label: string;
  detail?: string;
  amountMinor?: number;
}

export interface LivePdfDocument {
  kind: "quotation" | "reservation" | "rental" | "invoice";
  id: number;
  status: string;
  companyName: string;
  branchName?: string;
  currency: string;
  customerName: string;
  createdAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  rentalDays?: number;
  lines: LivePdfLineItem[];
  pricing?: {
    subtotalMinor: number;
    discountPct?: number;
    discountMinor: number;
    vatRatePct: number;
    vatMinor: number;
    totalMinor: number;
  };
  notes?: string | null;
  serverPdfPath?: string;
}

function escapePdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function buildLivePdfBlob(lines: string[]): Blob {
  const safeLines = lines.slice(0, 44);
  const contentCommands = [
    "BT",
    "/F2 15 Tf",
    "48 765 Td",
    `(${escapePdfText(safeLines[0] ?? "DriveCore ERP Document")}) Tj`,
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

const KIND_TITLES: Record<LivePdfDocument["kind"], string> = {
  quotation: "Official quotation",
  reservation: "Reservation confirmation",
  rental: "Rental agreement",
  invoice: "Tax invoice",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function LiveDocumentPdfModal({
  doc,
  onClose,
}: {
  doc: LivePdfDocument | null;
  onClose: () => void;
}) {
  const [statusMessage, setStatusMessage] = useState("");
  const [serverBusy, setServerBusy] = useState(false);

  if (!doc) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const title = KIND_TITLES[doc.kind];
  const filename = `drivecore-${doc.kind}-${doc.id}.pdf`;

  function handleInstantDownload() {
    if (!doc) return;
    const lines: string[] = [
      `DRIVECORE ERP - ${title.toUpperCase()}`,
      `Company: ${doc.companyName}${doc.branchName ? ` | Branch: ${doc.branchName}` : ""}`,
      `Reference: #${doc.id} | Status: ${doc.status.replaceAll("_", " ").toUpperCase()}`,
      `Issued: ${fmtDate(doc.createdAt)}`,
      "---------------------------------------------------------------------",
      `Customer: ${doc.customerName}`,
    ];
    if (doc.startsAt || doc.endsAt) {
      lines.push(
        `Period: ${fmtDate(doc.startsAt)} -> ${fmtDate(doc.endsAt)}${doc.rentalDays ? ` (${doc.rentalDays} day${doc.rentalDays === 1 ? "" : "s"})` : ""}`,
      );
    }
    lines.push(
      "---------------------------------------------------------------------",
    );
    for (const item of doc.lines) {
      const amount =
        item.amountMinor !== undefined
          ? ` | ${formatMoneyMinor(item.amountMinor, doc.currency)}`
          : "";
      lines.push(
        `- ${item.label}${item.detail ? ` (${item.detail})` : ""}${amount}`,
      );
    }
    if (doc.pricing) {
      lines.push(
        "---------------------------------------------------------------------",
        `Subtotal: ${formatMoneyMinor(doc.pricing.subtotalMinor, doc.currency)}`,
        `Discount${doc.pricing.discountPct ? ` (${doc.pricing.discountPct}%)` : ""}: -${formatMoneyMinor(doc.pricing.discountMinor, doc.currency)}`,
        `VAT (${doc.pricing.vatRatePct}%): ${formatMoneyMinor(doc.pricing.vatMinor, doc.currency)}`,
        `TOTAL: ${formatMoneyMinor(doc.pricing.totalMinor, doc.currency)}`,
      );
    }
    if (doc.notes) {
      lines.push(
        "---------------------------------------------------------------------",
        `Notes: ${doc.notes.slice(0, 120)}`,
      );
    }
    const blob = buildLivePdfBlob(lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatusMessage(`Downloaded ${filename}.`);
  }

  async function handleServerDownload() {
    if (!doc?.serverPdfPath || serverBusy) return;
    setServerBusy(true);
    setStatusMessage("");
    try {
      const res = await fetch(`/api/backend/${doc.serverPdfPath}?download=1`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        setStatusMessage(
          res.status === 404
            ? "Server PDF endpoint is not deployed on this API yet. Use Download PDF instead."
            : `Server PDF returned HTTP ${res.status}. Use Download PDF instead.`,
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatusMessage(`Downloaded server PDF (${filename}).`);
    } catch {
      setStatusMessage(
        "Could not reach server PDF endpoint. Use Download PDF instead.",
      );
    } finally {
      setServerBusy(false);
    }
  }

  const hasAmounts = doc.lines.some((l) => l.amountMinor !== undefined);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setStatusMessage("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-link" aria-hidden="true" />
            {title} #{doc.id}
          </DialogTitle>
          <DialogDescription>
            Preview, print, or download a formatted PDF copy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 rounded-xl border border-border/80 bg-background p-5 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
            <div className="space-y-1">
              <DriveCoreLogo />
              <p className="text-xs text-muted-foreground">
                {doc.companyName}
                {doc.branchName ? ` · ${doc.branchName}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground">
                {title}
              </p>
              <p className="font-mono text-lg font-semibold">#{doc.id}</p>
              <div className="mt-1 flex justify-end">
                <StatusDotBadge tone="neutral">
                  {doc.status.replaceAll("_", " ")}
                </StatusDotBadge>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Customer
              </p>
              <p className="font-medium">{doc.customerName}</p>
            </div>
            {doc.startsAt || doc.endsAt ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Rental window
                </p>
                <p className="font-mono text-xs tabular-nums">
                  {fmtDate(doc.startsAt)} → {fmtDate(doc.endsAt)}
                </p>
                {doc.rentalDays ? (
                  <p className="text-xs text-muted-foreground">
                    {doc.rentalDays} billing day{doc.rentalDays === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-border/80">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-border/70 bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                  {hasAmounts ? (
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {doc.lines.map((line, idx) => (
                  <tr key={`${line.label}-${idx}`}>
                    <td className="px-3 py-2 font-medium">{line.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {line.detail || "—"}
                    </td>
                    {hasAmounts ? (
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {line.amountMinor !== undefined
                          ? formatMoneyMinor(line.amountMinor, doc.currency)
                          : "—"}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {doc.pricing ? (
            <div className="ml-auto max-w-xs space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono tabular-nums">
                  {formatMoneyMinor(doc.pricing.subtotalMinor, doc.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount
                  {doc.pricing.discountPct
                    ? ` (${doc.pricing.discountPct}%)`
                    : ""}
                </span>
                <span className="font-mono tabular-nums">
                  -{formatMoneyMinor(doc.pricing.discountMinor, doc.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  VAT ({doc.pricing.vatRatePct}%)
                </span>
                <span className="font-mono tabular-nums">
                  {formatMoneyMinor(doc.pricing.vatMinor, doc.currency)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/70 pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatMoneyMinor(doc.pricing.totalMinor, doc.currency)}
                </span>
              </div>
            </div>
          ) : null}

          {doc.notes ? (
            <div className="border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Notes: </span>
              {doc.notes}
            </div>
          ) : null}
        </div>

        {statusMessage ? (
          <p
            role="status"
            className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-xs text-success-foreground"
          >
            {statusMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 transition-transform duration-150 ease-out active:scale-[0.98]"
          >
            <Printer className="size-3.5" aria-hidden="true" />
            Print
          </Button>
          {doc.serverPdfPath ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={serverBusy}
              onClick={() => {
                void handleServerDownload();
              }}
              className="gap-1.5 transition-transform duration-150 ease-out active:scale-[0.98]"
            >
              <Server className="size-3.5" aria-hidden="true" />
              {serverBusy ? "Fetching PDF…" : "Server PDF"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={handleInstantDownload}
            className="gap-1.5 transition-transform duration-150 ease-out active:scale-[0.98]"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
