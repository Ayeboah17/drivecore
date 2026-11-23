"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import { listComplianceExpiries } from "@/features/governance/service";
import { documentDownloadUrl } from "@/features/documents/service";
import { errorText } from "@/lib/api/client";
import {
  complianceCategories,
  type ComplianceBucket,
} from "@/lib/api/contracts";
import { downloadCsv } from "@/lib/csv";
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
  type StatusDotTone,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";

const BUCKET_TONE: Record<ComplianceBucket, StatusDotTone> = {
  expired: "danger",
  d7: "danger",
  d14: "warning",
  d30: "warning",
  valid: "success",
};

const BUCKET_LABEL: Record<ComplianceBucket, string> = {
  expired: "Expired",
  d7: "<= 7 days",
  d14: "<= 14 days",
  d30: "<= 30 days",
  valid: "Valid",
};

export function CompliancePanel() {
  const scope = useLiveContext();
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const suffix = `?branch=${scope.branch}`;

  const [bucket, setBucket] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const query = useQuery({
    queryKey: [...scope.key, "compliance", branchId ?? "all", bucket, category],
    queryFn: ({ signal }) =>
      listComplianceExpiries(
        {
          companyId: scope.companyId,
          branchId,
          bucket: bucket || undefined,
          category: category || undefined,
        },
        signal,
      ),
    enabled: !!scope.companyId,
    retry: false,
  });

  if (query.data && !query.data.supported) {
    return (
      <StatePanel title="Compliance expiry hub not yet deployed">
        Compliance &amp; document expiry tracking requires backend PR #17
        (/api/v1/compliance/expiries).
      </StatePanel>
    );
  }

  const items = query.data?.items ?? [];
  const summary = query.data?.summary;

  function handleExportCsv() {
    downloadCsv(
      `drivecore-compliance-expiries-co${scope.companyId}.csv`,
      ["Document", "Category", "Entity", "Expires at", "Days remaining", "Bucket"],
      items.map((r) => [
        r.original_name,
        r.category,
        r.entity_label ?? `${r.entity_type ?? ""}#${r.entity_id ?? ""}`,
        r.expires_at,
        r.days_remaining,
        BUCKET_LABEL[r.bucket],
      ]),
    );
  }

  function entityHref(entityType: string | null, entityId: number | null) {
    if (!entityType || !entityId) return null;
    if (entityType === "vehicle")
      return `/companies/${scope.companyId}/vehicles/${entityId}${suffix}`;
    if (entityType === "customer")
      return `/companies/${scope.companyId}/customers/${entityId}${suffix}`;
    if (entityType === "rental")
      return `/companies/${scope.companyId}/rentals/${entityId}${suffix}`;
    return null;
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["expired", "Expired", summary.expired],
              ["d7", "Expiring <= 7d", summary.d7],
              ["d14", "Expiring <= 14d", summary.d14],
              ["d30", "Expiring <= 30d", summary.d30],
              ["valid", "Valid (> 30d)", summary.valid],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setBucket((prev) => (prev === key ? "" : key))}
              className={`dc-shadow-card rounded-2xl border p-3.5 text-left transition-colors ${
                bucket === key
                  ? "border-primary bg-primary/5"
                  : "bg-surface hover:border-primary/40"
              }`}
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-xl font-extrabold tabular-nums">
                {count}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <DriveCoreSelect
              ariaLabel="Filter compliance by category"
              value={category}
              onValueChange={setCategory}
              options={[
                { value: "", label: "All categories" },
                ...complianceCategories.map((c) => ({
                  value: c,
                  label: c.replace(/_/g, " "),
                })),
              ]}
            />
          </div>
          {bucket ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setBucket("")}
            >
              Clear bucket
            </Button>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleExportCsv}
          className="gap-1.5"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <DataTableFrame ariaLabel="Compliance document expiries">
        {query.isPending ? (
          <DataTableSkeleton columns={6} label="Loading compliance expiries" />
        ) : query.error ? (
          <div className="p-card">
            <StatePanel title="Compliance expiries unavailable">
              {errorText(query.error)}
            </StatePanel>
          </div>
        ) : items.length === 0 ? (
          <div className="p-card">
            <StatePanel title="No expiring compliance documents">
              Upload vehicle insurance, roadworthy certificates, and licences
              with expiry dates to track them here.
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Document</DataTableHeaderCell>
                <DataTableHeaderCell>Category</DataTableHeaderCell>
                <DataTableHeaderCell>Entity</DataTableHeaderCell>
                <DataTableHeaderCell>Expires</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Days left</DataTableHeaderCell>
                <DataTableHeaderCell align="right">File</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((r) => {
                const href = entityHref(r.entity_type, r.entity_id);
                return (
                  <DataTableRow key={r.document_id}>
                    <DataTableCell className="font-medium">
                      {r.original_name}
                    </DataTableCell>
                    <DataTableCell className="capitalize text-muted-foreground">
                      {r.category.replace(/_/g, " ")}
                    </DataTableCell>
                    <DataTableCell>
                      {href ? (
                        <Link
                          href={href}
                          className="text-xs font-medium text-link hover:underline"
                        >
                          {r.entity_label ?? `${r.entity_type} #${r.entity_id}`}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.entity_label ?? "Company"}
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs">
                      {r.expires_at.slice(0, 10)}
                    </DataTableCell>
                    <DataTableCell align="right">
                      <StatusDotBadge tone={BUCKET_TONE[r.bucket]}>
                        {r.days_remaining < 0
                          ? `${Math.abs(r.days_remaining)}d overdue`
                          : `${r.days_remaining}d`}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <a
                        href={documentDownloadUrl(r.document_id)}
                        className="text-xs font-medium text-link hover:underline"
                      >
                        Download
                      </a>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>
    </div>
  );
}
