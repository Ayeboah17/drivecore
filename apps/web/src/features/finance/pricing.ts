import type { Invoice } from "@/lib/api/contracts";

export interface InvoiceLineDraft {
  description: string;
  quantity: number;
  unit_price_minor: number;
}

export interface InvoicePricingPreview {
  subtotalMinor: number;
  discountMinor: number;
  taxableMinor: number;
  vatMinor: number;
  totalMinor: number;
}

/**
 * Deterministic minor-unit invoice preview matching backend rounding rules
 * (VAT applied after discount). Authoritative totals are always computed by the server.
 */
export function calculateInvoicePreview(params: {
  lines: readonly InvoiceLineDraft[];
  discountPct: number;
  vatRatePct: number;
}): InvoicePricingPreview {
  const subtotalMinor = params.lines.reduce((sum, line) => {
    const qty = Math.max(0, Math.floor(line.quantity));
    const unit = Math.max(0, Math.round(line.unit_price_minor));
    return sum + qty * unit;
  }, 0);
  const clampedDiscount = Math.min(100, Math.max(0, params.discountPct));
  const clampedVat = Math.min(100, Math.max(0, params.vatRatePct));
  const discountMinor = Math.round(subtotalMinor * (clampedDiscount / 100));
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor);
  const vatMinor = Math.round(taxableMinor * (clampedVat / 100));
  const totalMinor = taxableMinor + vatMinor;
  return {
    subtotalMinor,
    discountMinor,
    taxableMinor,
    vatMinor,
    totalMinor,
  };
}

export type InvoiceDisplayStatus =
  | "draft"
  | "issued"
  | "overdue"
  | "paid"
  | "void";

/** Derives UI badge status from stored invoice status, balance, and due date. */
export function invoiceDisplayStatus(invoice: Invoice): InvoiceDisplayStatus {
  if (invoice.status === "void") return "void";
  if (invoice.status === "draft") return "draft";
  if (invoice.outstanding_minor === 0 && invoice.paid_minor > 0) return "paid";
  if (invoice.is_overdue || Date.parse(invoice.due_at) < Date.now()) {
    return "overdue";
  }
  return "issued";
}
