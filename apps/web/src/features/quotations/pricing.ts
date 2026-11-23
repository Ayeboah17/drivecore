export interface QuotationPricingPreview {
  rentalDays: number;
  subtotalMinor: number;
  discountMinor: number;
  taxableMinor: number;
  vatMinor: number;
  totalMinor: number;
  requiresApproval: boolean;
}

/**
 * Mirrors the authoritative backend started-24h integer minor-unit pricing formula.
 * VAT is applied strictly after discount; backend recomputes and remains source of truth.
 */
export function calculateQuotationPreview({
  dailyRatesMinor,
  startsAt,
  endsAt,
  discountPct,
  vatRatePct,
  thresholdPct,
}: {
  dailyRatesMinor: readonly number[];
  startsAt: string;
  endsAt: string;
  discountPct: number;
  vatRatePct: number;
  thresholdPct: number;
}): QuotationPricingPreview {
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  const rentalDays =
    !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs
      ? Math.max(1, Math.ceil((endMs - startMs) / 86_400_000))
      : 1;

  const safeDiscount = Math.min(
    100,
    Math.max(0, Number.isFinite(discountPct) ? discountPct : 0),
  );
  const safeVat = Math.min(
    100,
    Math.max(0, Number.isFinite(vatRatePct) ? vatRatePct : 0),
  );
  const safeThreshold = Math.min(
    100,
    Math.max(0, Number.isFinite(thresholdPct) ? thresholdPct : 0),
  );

  const subtotalMinor = dailyRatesMinor.reduce(
    (sum, rate) => sum + Math.max(0, Math.round(rate)) * rentalDays,
    0,
  );
  const discountMinor = Math.round(subtotalMinor * (safeDiscount / 100));
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor);
  const vatMinor = Math.round(taxableMinor * (safeVat / 100));
  const totalMinor = taxableMinor + vatMinor;

  return {
    rentalDays,
    subtotalMinor,
    discountMinor,
    taxableMinor,
    vatMinor,
    totalMinor,
    requiresApproval: safeDiscount > safeThreshold,
  };
}
