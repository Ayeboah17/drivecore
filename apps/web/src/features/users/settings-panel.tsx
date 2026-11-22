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
import {
  canManageCompanySettings,
  type CompanySettings,
  type DistanceUnit,
  type FuelEfficiencyUnit,
  type VolumeUnit,
  type WeightUnit,
} from "@/lib/api/contracts";
import {
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "@/lib/api/error-format";
import { StatePanel } from "@/components/layout/state-panel";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsForm({
  initial,
  currency,
  canEdit,
  notice,
  onSaved,
}: {
  initial: CompanySettings;
  currency: string;
  canEdit: boolean;
  notice: string;
  onSaved: () => void;
}) {
  const scope = useLiveContext();
  const session = useSession();
  const formId = useId();
  const [vat, setVat] = useState(String(initial.vat_rate_pct));
  const [threshold, setThreshold] = useState(
    String(initial.discount_approval_threshold_pct),
  );
  const [fuelUnit, setFuelUnit] = useState<FuelEfficiencyUnit>(
    initial.fuel_efficiency_unit ?? "l_per_100km",
  );
  const [distUnit, setDistUnit] = useState<DistanceUnit>(
    initial.distance_unit ?? "km",
  );
  const [volUnit, setVolUnit] = useState<VolumeUnit>(
    initial.volume_unit ?? "l",
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    initial.weight_unit ?? "kg",
  );
  const [requirePhotos, setRequirePhotos] = useState(
    Boolean(initial.require_inspection_photos),
  );
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
      await updateCompanySettings(
        scope.companyId,
        {
          vat_rate_pct: vatNum,
          discount_approval_threshold_pct: thresholdNum,
          fuel_efficiency_unit: fuelUnit,
          distance_unit: distUnit,
          volume_unit: volUnit,
          weight_unit: weightUnit,
          require_inspection_photos: requirePhotos,
        },
        controller.current.signal,
      );
      onSaved();
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

        <div className="sm:col-span-2 border-t pt-4">
          <h3 className="text-sm font-semibold">
            Measurement units (client-side display conversion)
          </h3>
          <p className="text-xs text-muted-foreground">
            Records are stored canonically in metric (km, L, kg) and converted
            instantly in your browser.
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Fuel efficiency unit</span>
          <DriveCoreSelect
            ariaLabel="Fuel efficiency unit"
            value={fuelUnit}
            onValueChange={(v) => setFuelUnit(v as FuelEfficiencyUnit)}
            options={[
              { value: "l_per_100km", label: "L/100km (default)" },
              { value: "km_per_l", label: "km/L" },
              { value: "mpg_us", label: "MPG (US)" },
              { value: "mpg_uk", label: "MPG (UK)" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Distance unit</span>
          <DriveCoreSelect
            ariaLabel="Distance unit"
            value={distUnit}
            onValueChange={(v) => setDistUnit(v as DistanceUnit)}
            options={[
              { value: "km", label: "Kilometres (km)" },
              { value: "mi", label: "Miles (mi)" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Fuel volume unit</span>
          <DriveCoreSelect
            ariaLabel="Fuel volume unit"
            value={volUnit}
            onValueChange={(v) => setVolUnit(v as VolumeUnit)}
            options={[
              { value: "l", label: "Litres (L)" },
              { value: "gal_us", label: "US Gallons (gal)" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Weight unit</span>
          <DriveCoreSelect
            ariaLabel="Weight unit"
            value={weightUnit}
            onValueChange={(v) => setWeightUnit(v as WeightUnit)}
            options={[
              { value: "kg", label: "Kilograms (kg)" },
              { value: "lb", label: "Pounds (lb)" },
            ]}
          />
        </div>

        <label className="sm:col-span-2 flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={requirePhotos}
            onChange={(e) => setRequirePhotos(e.target.checked)}
            className="size-3.5 rounded border"
          />
          Require inspection photos before completing handover/return
        </label>
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
      key={`${query.data.company_id}:${query.data.vat_rate_pct}:${query.data.discount_approval_threshold_pct}:${query.data.fuel_efficiency_unit}:${query.data.distance_unit}:${query.data.volume_unit}:${query.data.weight_unit}:${query.data.require_inspection_photos}`}
      initial={query.data}
      currency={query.data.currency || scope.company?.currency || "ZMW"}
      canEdit={canEdit}
      notice={notice}
      onSaved={() => {
        setNotice("Financial settings updated.");
        void client.invalidateQueries({
          queryKey: [...scope.key, "company-settings"],
        });
        void client.invalidateQueries({
          queryKey: ["live", "company-settings", scope.companyId],
        });
      }}
    />
  );
}
