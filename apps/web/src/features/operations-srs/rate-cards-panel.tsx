"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tags } from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import {
  createRateCard,
  listRateCards,
  useUnitPreferences,
} from "@/features/operations-srs/service";
import { errorText } from "@/lib/api/client";
import {
  formatMoneyMinor,
  parseMajorToMinor,
  type FuelPolicy,
} from "@/lib/api/contracts";
import { formatDistance } from "@/lib/units";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableSkeleton,
  StatusDotBadge,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";

const FUEL_POLICY_LABELS: Record<FuelPolicy, string> = {
  full_to_full: "Full-to-Full",
  same_to_same: "Same-to-Same",
  prepaid: "Prepaid",
};

export function RateCardsPanel({ canManage }: { canManage: boolean }) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const units = useUnitPreferences(scope.companyId);
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [dailyText, setDailyText] = useState("");
  const [weeklyText, setWeeklyText] = useState("");
  const [kmLimit, setKmLimit] = useState("200");
  const [excessRateText, setExcessRateText] = useState("5.00");
  const [depositText, setDepositText] = useState("0");
  const [fuelPolicy, setFuelPolicy] = useState<FuelPolicy>("full_to_full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [...scope.key, "rate-cards", branchId ?? "all"],
    queryFn: ({ signal }) =>
      listRateCards({ companyId: scope.companyId, branchId }, signal),
    enabled: !!scope.companyId,
    retry: false,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dailyMinor = parseMajorToMinor(dailyText.trim());
    if (!name.trim() || dailyMinor === null || dailyMinor <= 0) {
      setError("Enter a rate card name and a positive daily rate.");
      return;
    }
    const weeklyMinor = weeklyText.trim()
      ? parseMajorToMinor(weeklyText.trim())
      : null;
    const excessMinor = parseMajorToMinor(excessRateText.trim() || "0") ?? 0;
    const depositMinor = parseMajorToMinor(depositText.trim() || "0") ?? 0;
    const dailyKmLimit = kmLimit.trim() ? Number(kmLimit.trim()) : null;

    setBusy(true);
    try {
      await createRateCard({
        company_id: Number(scope.companyId),
        branch_id: branchId ? Number(branchId) : null,
        name: name.trim(),
        vehicle_category: category.trim() || null,
        daily_rate_minor: dailyMinor,
        weekly_rate_minor: weeklyMinor,
        daily_km_limit: dailyKmLimit,
        excess_km_rate_minor: excessMinor,
        security_deposit_minor: depositMinor,
        fuel_policy: fuelPolicy,
        is_active: true,
      });
      setName("");
      setCategory("");
      setDailyText("");
      setWeeklyText("");
      setOpen(false);
      await client.invalidateQueries({ queryKey: [...scope.key, "rate-cards"] });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (query.data && !query.data.supported) {
    return (
      <StatePanel title="Rate cards endpoint not yet deployed">
        Configurable rate cards require backend PR #16 (/api/v1/rate-cards).
      </StatePanel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Configure daily/weekly/monthly rates, mileage limits, security
          deposits, and fuel policies.
        </p>
        {canManage ? (
          <Button type="button" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden="true" />
            New rate card
          </Button>
        ) : null}
      </div>

      <DataTableFrame ariaLabel="Rate cards">
        {query.isPending ? (
          <DataTableSkeleton columns={7} label="Loading rate cards" />
        ) : query.error || !query.data ? (
          <div className="p-card">
            <StatePanel title="Rate cards unavailable">
              {errorText(query.error)}
            </StatePanel>
          </div>
        ) : query.data.items.length === 0 ? (
          <div className="p-card">
            <StatePanel title="No rate cards yet">
              Create a rate card to standardize daily rates, mileage allowances,
              and fuel policies.
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Rate card</DataTableHeaderCell>
                <DataTableHeaderCell>Category</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Daily rate</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Weekly rate</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Daily limit</DataTableHeaderCell>
                <DataTableHeaderCell>Fuel policy</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {query.data.items.map((rc) => (
                <DataTableRow key={rc.id}>
                  <DataTableCell className="font-semibold">{rc.name}</DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {rc.vehicle_category || "All categories"}
                  </DataTableCell>
                  <DataTableCell align="right" numeric>
                    {formatMoneyMinor(rc.daily_rate_minor, currency)}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="text-muted-foreground">
                    {rc.weekly_rate_minor !== null
                      ? formatMoneyMinor(rc.weekly_rate_minor, currency)
                      : "—"}
                  </DataTableCell>
                  <DataTableCell align="right" numeric className="text-muted-foreground">
                    {rc.daily_km_limit !== null
                      ? `${formatDistance(rc.daily_km_limit, units.distance)}/day`
                      : "Unlimited"}
                  </DataTableCell>
                  <DataTableCell>
                    {FUEL_POLICY_LABELS[rc.fuel_policy]}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusDotBadge tone={rc.is_active ? "success" : "neutral"}>
                      {rc.is_active ? "Active" : "Inactive"}
                    </StatusDotBadge>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-4 text-link" aria-hidden="true" />
              New rate card
            </DialogTitle>
            <DialogDescription>
              Define standard rental pricing, mileage limits, and fuel policy.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="rc-name" className="text-xs font-medium">
                  Rate card name
                </label>
                <Input
                  id="rc-name"
                  placeholder="e.g. Corporate SUV Standard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="rc-cat" className="text-xs font-medium">
                  Vehicle category (optional)
                </label>
                <Input
                  id="rc-cat"
                  placeholder="e.g. SUV / 4x4"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="rc-daily" className="text-xs font-medium">
                  Daily rate ({currency})
                </label>
                <Input
                  id="rc-daily"
                  inputMode="decimal"
                  placeholder="1500.00"
                  value={dailyText}
                  onChange={(e) => setDailyText(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="rc-weekly" className="text-xs font-medium">
                  Weekly rate ({currency}, optional)
                </label>
                <Input
                  id="rc-weekly"
                  inputMode="decimal"
                  placeholder="9500.00"
                  value={weeklyText}
                  onChange={(e) => setWeeklyText(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="rc-km" className="text-xs font-medium">
                  Daily km limit
                </label>
                <Input
                  id="rc-km"
                  inputMode="numeric"
                  value={kmLimit}
                  onChange={(e) => setKmLimit(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="rc-excess" className="text-xs font-medium">
                  Excess/km ({currency})
                </label>
                <Input
                  id="rc-excess"
                  inputMode="decimal"
                  value={excessRateText}
                  onChange={(e) => setExcessRateText(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="rc-deposit" className="text-xs font-medium">
                  Deposit ({currency})
                </label>
                <Input
                  id="rc-deposit"
                  inputMode="decimal"
                  value={depositText}
                  onChange={(e) => setDepositText(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-xs font-medium">Fuel policy</span>
              <DriveCoreSelect
                ariaLabel="Fuel policy"
                value={fuelPolicy}
                onValueChange={(v) => setFuelPolicy(v as FuelPolicy)}
                options={[
                  { value: "full_to_full", label: "Full-to-Full" },
                  { value: "same_to_same", label: "Same-to-Same" },
                  { value: "prepaid", label: "Prepaid" },
                ]}
              />
            </div>

            {error ? (
              <p role="alert" className="text-xs text-danger-foreground">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Create rate card"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
