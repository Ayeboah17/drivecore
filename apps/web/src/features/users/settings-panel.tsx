"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Percent, Save } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  getCompanySettings,
  updateCompanySettings,
} from "@/features/quotations/service";
import { ApiError, errorText } from "@/lib/api/client";
import { canManageCompanySettings } from "@/lib/api/contracts";
import {
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "@/lib/api/error-format";
import { StatePanel } from "@/components/layout/state-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsForm({
  initialVat,
  initialThreshold,
  currency,
  canEdit,
  notice,
  onSaved,
}: {
  initialVat: number;
  initialThreshold: number;
  currency: string;
  canEdit: boolean;
  notice: string;
  onSaved: (vat: number, threshold: number) => void;
}) {
  const scope = useLiveContext();
  const session = useSession();
  const formId = useId();
  const [vat, setVat] = useState(String(initialVat));
  const [threshold, setThreshold] = useState(String(initialThreshold));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit || lock.current) return;
    const vatNum = Number(vat);
    const thresholdNum = Number(threshold);
    if (
      vat.trim() === "" ||
      Number.isNaN(vatNum) ||
      vatNum < 0 ||
      vatNum > 100
    ) {
      setError(new Error("Enter a VAT rate between 0 and 100%."));
      return;
    }
    if (
      threshold.trim() === "" ||
      Number.isNaN(thresholdNum) ||
      thresholdNum < 0 ||
      thresholdNum > 100
    ) {
      setError(
        new Error("Enter a discount approval threshold between 0 and 100%."),
      );
      return;
    }

    lock.current = true;
    setBusy(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const updated = await updateCompanySettings(
        scope.companyId,
        {
          vat_rate_pct: vatNum,
          discount_approval_threshold_pct: thresholdNum,
        },
        controller.current.signal,
      );
      onSaved(updated.vat_rate_pct, updated.discount_approval_threshold_pct);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy}
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="dc-shadow-card max-w-2xl space-y-5 rounded-2xl border border-border/80 bg-surface p-card"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-section-heading">
            <Percent className="size-4 text-link" aria-hidden="true" />
            Financial &amp; quotation settings
          </h2>
          <p className="text-xs text-muted-foreground">
            Applied to new quotations and invoices for {scope.company?.name} (
            {currency}). Existing quotations keep their snapshotted rates.
          </p>
        </div>
      </div>

      <fieldset disabled={!canEdit || busy} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-vat`} className="text-sm font-medium">
            VAT rate (%)
          </label>
          <Input
            id={`${formId}-vat`}
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={vat}
            onChange={(e) => setVat(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Applied after discount on new quotations.
          </p>
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`${formId}-threshold`}
            className="text-sm font-medium"
          >
            Discount approval threshold (%)
          </label>
          <Input
            id={`${formId}-threshold`}
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Discounts strictly above this percentage require Finance or Admin
            approval.
          </p>
        </div>
      </fieldset>

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-xs text-success-foreground"
        >
          {notice}
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="space-y-1 rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger-foreground"
        >
          <p>{errorText(error)}</p>
          {error instanceof ApiError && error.status === 422 ? (
            <ul className="list-disc pl-4 text-xs">
              {Object.entries(error.fields).map(([field, msgs]) => (
                <li key={field}>
                  {humanizeFieldLabel(field)}:{" "}
                  {msgs.map(humanizeFieldMessage).join(" ")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="gap-1.5">
            <Save className="size-4" aria-hidden="true" />
            {busy ? "Saving…" : "Save settings"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function FinancialSettingsPanel() {
  const scope = useLiveContext();
  const { user } = useSession();
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const canEdit = !!user && canManageCompanySettings(user, scope.companyId);

  const query = useQuery({
    queryKey: [...scope.key, "company-settings"],
    queryFn: ({ signal }) => getCompanySettings(scope.companyId, signal),
    staleTime: 0,
  });

  if (query.isPending) {
    return (
      <div role="status" className="max-w-2xl space-y-3">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <StatePanel
        title="Financial settings unavailable"
        onRetry={() => {
          void query.refetch();
        }}
      >
        {errorText(query.error)}
      </StatePanel>
    );
  }

  return (
    <SettingsForm
      key={`${query.data.company_id}:${query.data.vat_rate_pct}:${query.data.discount_approval_threshold_pct}`}
      initialVat={query.data.vat_rate_pct}
      initialThreshold={query.data.discount_approval_threshold_pct}
      currency={query.data.currency || scope.company?.currency || "ZMW"}
      canEdit={canEdit}
      notice={notice}
      onSaved={() => {
        setNotice("Financial settings updated.");
        void client.invalidateQueries({
          queryKey: [...scope.key, "company-settings"],
        });
      }}
    />
  );
}
