"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Save, ShieldCheck } from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import { getApprovalThresholds, updateApprovalThresholds } from "./service";
import { errorText } from "@/lib/api/client";
import {
  approvalTypeLabels,
  approvalTypes,
  managedRoleLabels,
  parseMajorToMinor,
  type ApprovalThreshold,
  type ApprovalType,
  type ManagedRoleName,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";

const APPROVER_ROLES: ManagedRoleName[] = [
  "ceo",
  "general-manager",
  "finance-manager",
  "credit-control-manager",
  "maintenance-manager",
  "operations-manager",
  "system-administrator",
];

function defaultThresholds(): ApprovalThreshold[] {
  return approvalTypes.map((type) => ({
    type,
    threshold_minor: type === "discount" ? null : 500_000,
    threshold_pct: type === "discount" ? 10 : null,
    approver_role:
      type === "vehicle_disposal"
        ? "ceo"
        : type === "credit_limit"
          ? "credit-control-manager"
          : type === "vehicle_repair"
            ? "maintenance-manager"
            : "finance-manager",
    is_active: true,
  }));
}

export function ApprovalThresholdsCard({ canEdit }: { canEdit: boolean }) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";

  const query = useQuery({
    queryKey: [...scope.key, "approval-thresholds"],
    queryFn: ({ signal }) => getApprovalThresholds(scope.companyId, signal),
    retry: false,
  });

  const [draft, setDraft] = useState<ApprovalThreshold[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rows = draft ?? query.data ?? defaultThresholds();

  function updateRow(type: ApprovalType, patch: Partial<ApprovalThreshold>) {
    const next = rows.map((r) => (r.type === type ? { ...r, ...patch } : r));
    setDraft(next);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setError(null);
    setNotice("");
    setBusy(true);
    try {
      const saved = await updateApprovalThresholds(scope.companyId, rows);
      setDraft(saved);
      setNotice("Approval thresholds matrix updated.");
      await client.invalidateQueries({
        queryKey: [...scope.key, "approval-thresholds"],
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="dc-shadow-card max-w-4xl space-y-4 rounded-2xl border border-border/80 bg-surface p-card"
    >
      <div className="space-y-1 border-b border-border/70 pb-3">
        <h2 className="flex items-center gap-2 text-section-heading">
          <ShieldCheck className="size-4 text-link" aria-hidden="true" />
          Configurable Approval Thresholds (SRS §20)
        </h2>
        <p className="text-xs text-muted-foreground">
          Define transaction limits and required SRS §3 approver roles across
          all 7 governed approval workflows.
        </p>
      </div>

      <fieldset disabled={!canEdit || busy} className="space-y-2.5">
        {rows.map((row) => {
          const isPct = row.type === "discount";
          return (
            <div
              key={row.type}
              className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[1.3fr_1fr_1.2fr]"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Enable ${approvalTypeLabels[row.type]} threshold`}
                  checked={row.is_active}
                  onChange={(e) =>
                    updateRow(row.type, { is_active: e.target.checked })
                  }
                  className="size-3.5 rounded border"
                />
                <span className="text-xs font-semibold">
                  {approvalTypeLabels[row.type]}
                </span>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  {isPct ? "Threshold (%)" : `Threshold (${currency})`}
                </label>
                <Input
                  aria-label={`${approvalTypeLabels[row.type]} limit`}
                  inputMode="decimal"
                  defaultValue={
                    isPct
                      ? String(row.threshold_pct ?? 10)
                      : ((row.threshold_minor ?? 0) / 100).toFixed(2)
                  }
                  onBlur={(e) => {
                    if (isPct) {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n) && n >= 0 && n <= 100) {
                        updateRow(row.type, { threshold_pct: n });
                      }
                    } else {
                      const m = parseMajorToMinor(e.target.value);
                      if (m !== null) {
                        updateRow(row.type, { threshold_minor: m });
                      }
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] text-muted-foreground">
                  Required SRS §3 approver role
                </span>
                <DriveCoreSelect
                  ariaLabel={`${approvalTypeLabels[row.type]} approver role`}
                  value={row.approver_role}
                  onValueChange={(v) =>
                    updateRow(row.type, { approver_role: v })
                  }
                  options={APPROVER_ROLES.map((r) => ({
                    value: r,
                    label: managedRoleLabels[r],
                  }))}
                />
              </div>
            </div>
          );
        })}
      </fieldset>

      {notice ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger-foreground">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="gap-1.5">
            <Save className="size-4" aria-hidden="true" />
            {busy ? "Saving…" : "Save approval thresholds"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
