"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Upload, X } from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import { errorText } from "@/lib/api/client";
import {
  documentEntityLabels,
  documentEntityTypes,
  type DocumentEntityType,
} from "@/lib/api/contracts";
import {
  DataSearchForm,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableSkeleton,
  StatusDotBadge,
  type ActiveFilterChip,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  nextSortState,
  parseSortParams,
  sortRows,
  type SortDirection,
} from "@/lib/table-sort";
import {
  documentDownloadUrl,
  documentExpiryState,
  formatFileSize,
  listDocuments,
} from "./service";
import { UploadDocumentDialog } from "./upload-dialog";

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  const state = documentExpiryState(expiresAt);
  if (!state || !expiresAt) {
    return <span className="text-xs text-muted-foreground">No expiry</span>;
  }
  const formatted = new Date(expiresAt).toLocaleDateString();
  const styles =
    state === "expired"
      ? "border-danger text-danger-foreground"
      : state === "expiring"
        ? "border-warning text-warning-foreground"
        : "border-success text-success-foreground";
  const prefix =
    state === "expired"
      ? "Expired · "
      : state === "expiring"
        ? "Expiring · "
        : "";
  return (
    <Badge variant="outline" className={`font-mono text-[11px] ${styles}`}>
      {prefix}
      {formatted}
    </Badge>
  );
}

/** Embedded linked documents panel for Vehicle, Customer, Reservation, and Rental detail pages. */
export function EntityDocumentsPanel({
  entityType,
  entityId,
  branchId,
  canUpload,
}: {
  entityType: DocumentEntityType;
  entityId: number;
  branchId: number;
  canUpload: boolean;
}) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const docs = useQuery({
    queryKey: [...scope.key, "documents", "entity", entityType, entityId],
    queryFn: ({ signal }) =>
      listDocuments(
        {
          companyId: scope.companyId,
          branch: scope.branch,
          entityType,
          entityId,
        },
        signal,
      ),
    staleTime: 0,
  });

  return (
    <section
      aria-label="Linked documents"
      className="dc-shadow-card space-y-4 rounded-2xl border bg-surface p-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-section-heading">
            <FileText className="size-4 text-link" aria-hidden="true" />
            Documents
          </h2>
          <p className="text-xs text-muted-foreground">
            Private PDF and image files attached to{" "}
            {documentEntityLabels[entityType]} #{entityId}.
          </p>
        </div>
        {canUpload ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5"
          >
            <Upload className="size-3.5" aria-hidden="true" />
            Upload document
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-success bg-success/10 px-3 py-2 text-xs text-success-foreground"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss upload notice"
            onClick={() => setNotice("")}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {docs.isPending ? (
        <div role="status" className="space-y-2">
          <Skeleton className="h-9 w-full rounded-xl" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      ) : docs.error ? (
        <StatePanel
          title="Documents unavailable"
          onRetry={() => {
            void docs.refetch();
          }}
        >
          {errorText(docs.error)}
        </StatePanel>
      ) : docs.data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No documents attached yet.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {docs.data.items.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-semibold">{doc.original_name}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{doc.mime_type}</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">
                    {formatFileSize(doc.size)}
                  </span>
                  <ExpiryBadge expiresAt={doc.expires_at} />
                </div>
              </div>
              <a
                href={documentDownloadUrl(doc.id)}
                download={doc.original_name}
                className="inline-flex items-center gap-1.5 rounded-xl border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download
              </a>
            </li>
          ))}
        </ul>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        fixedBranchId={branchId}
        fixedEntityType={entityType}
        fixedEntityId={entityId}
        onUploaded={(uploaded, meta) => {
          setNotice(
            meta.requestedExpiry && !uploaded.expires_at
              ? `Uploaded ${uploaded.original_name}. Note: expiry date was not saved by this API version yet.`
              : `Uploaded ${uploaded.original_name}.`,
          );
          void client.invalidateQueries({
            queryKey: [...scope.key, "documents"],
          });
        }}
      />
    </section>
  );
}

const ENTITY_FILTER_OPTIONS = [
  { value: "", label: "All record types" },
  ...documentEntityTypes.map((type) => ({
    value: type,
    label: documentEntityLabels[type],
  })),
] as const;

const DOC_SORT_KEYS = ["original_name", "size", "expires_at"] as const;

/** Full scoped Documents library rendered inside the Live Operations workspace. */
export function DocumentsDirectory({ canUpload }: { canUpload: boolean }) {
  const scope = useLiveContext();
  const searchParams = useSearchParams();
  const client = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const rawQ = (searchParams.get("dq") ?? "").slice(0, 100);
  const rawType = searchParams.get("entity_type") ?? "";
  const entityType = documentEntityTypes.includes(rawType as DocumentEntityType)
    ? rawType
    : "";
  const parsedPage = Number(searchParams.get("dpage") ?? "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 1000000
      ? parsedPage
      : 1;
  const { sort, dir } = parseSortParams(
    searchParams.get("dsort"),
    searchParams.get("ddir"),
    DOC_SORT_KEYS,
  );

  function updateQuery(next: {
    q?: string;
    entityType?: string;
    page?: number;
    sort?: string;
    dir?: SortDirection | "";
  }) {
    const params = new URLSearchParams();
    params.set("branch", scope.branch);
    params.set("tab", "documents");
    const nextQ = (next.q !== undefined ? next.q : rawQ).trim().slice(0, 100);
    const nextType =
      next.entityType !== undefined ? next.entityType : entityType;
    const nextPage = next.page !== undefined ? next.page : 1;
    const nextSort = next.sort !== undefined ? next.sort : sort;
    const nextDir = next.dir !== undefined ? next.dir : dir;
    if (nextQ) params.set("dq", nextQ);
    if (nextType) params.set("entity_type", nextType);
    if (nextSort && nextDir) {
      params.set("dsort", nextSort);
      params.set("ddir", nextDir);
    }
    if (nextPage > 1) params.set("dpage", String(nextPage));
    scope.navigate(`/companies/${scope.companyId}/operations?${params.toString()}`);
  }

  function handleSort(columnKey: string) {
    const next = nextSortState(sort, dir, columnKey);
    updateQuery({ sort: next.sort, dir: next.dir, page: 1 });
  }

  const docs = useQuery({
    queryKey: [
      ...scope.key,
      "documents",
      "list",
      { q: rawQ.trim(), entityType, page, sort, dir },
    ],
    queryFn: ({ signal }) =>
      listDocuments(
        {
          companyId: scope.companyId,
          branch: scope.branch,
          entityType: entityType || undefined,
          q: rawQ,
          page,
          sort: sort || undefined,
          dir: dir || undefined,
        },
        signal,
      ),
    staleTime: 0,
  });

  const chips: ActiveFilterChip[] = [];
  if (rawQ.trim()) {
    chips.push({
      key: "dq",
      label: `Search: ${rawQ.trim()}`,
      onRemove: () => updateQuery({ q: "", page: 1 }),
    });
  }
  if (entityType) {
    chips.push({
      key: "entity_type",
      label: `Linked to: ${documentEntityLabels[entityType as DocumentEntityType]}`,
      onRemove: () => updateQuery({ entityType: "", page: 1 }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Private PDF and image vault scoped to {scope.company?.name}.
        </p>
        {canUpload ? (
          <Button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5"
          >
            <Upload className="size-4" aria-hidden="true" />
            Upload document
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss upload notice"
            onClick={() => setNotice("")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <DataTableFrame
        ariaLabel="Documents directory"
        chips={chips}
        onClearAll={
          chips.length > 0
            ? () => updateQuery({ q: "", entityType: "", page: 1 })
            : undefined
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <DataSearchForm
              label="Search documents"
              placeholder="Search filename or MIME type…"
              defaultValue={rawQ}
              formKey={`${scope.companyId}:${scope.branch}:docs:${rawQ}`}
              onSubmitQuery={(q) => updateQuery({ q, page: 1 })}
            />
            <div className="w-full space-y-1.5 sm:w-52">
              <span className="block text-xs font-medium text-muted-foreground">
                Linked record
              </span>
              <DriveCoreSelect
                ariaLabel="Filter by linked record type"
                value={entityType}
                onValueChange={(nextType) =>
                  updateQuery({ entityType: nextType, page: 1 })
                }
                options={ENTITY_FILTER_OPTIONS}
              />
            </div>
          </div>
        }
        footer={
          docs.data ? (
            <>
              <span className="font-mono text-xs tabular-nums">
                {docs.data.total}{" "}
                {docs.data.total === 1 ? "document" : "documents"} · Page{" "}
                {docs.data.page} of {docs.data.lastPage}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || docs.isFetching}
                  onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page >= docs.data.lastPage || docs.isFetching}
                  onClick={() => updateQuery({ page: page + 1 })}
                >
                  Next
                </Button>
              </div>
            </>
          ) : undefined
        }
      >
        {docs.isPending ? (
          <DataTableSkeleton columns={5} label="Loading documents" />
        ) : docs.error ? (
          <div className="p-card">
            <StatePanel
              title="Documents unavailable"
              onRetry={() => {
                void docs.refetch();
              }}
            >
              {errorText(docs.error)}
            </StatePanel>
          </div>
        ) : docs.data.items.length === 0 ? (
          <div className="p-card">
            <StatePanel
              title={chips.length > 0 ? "No matching documents" : "No documents yet"}
            >
              {chips.length > 0 ? (
                <div className="space-y-3">
                  <p>No documents matched the active search or filter.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateQuery({ q: "", entityType: "", page: 1 })
                    }
                  >
                    Clear search and filters
                  </Button>
                </div>
              ) : (
                <p>Upload a PDF or image to store it in this workspace.</p>
              )}
            </StatePanel>
          </div>
        ) : (
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell
                  sortKey="original_name"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  File
                </DataTableHeaderCell>
                <DataTableHeaderCell>Linked record</DataTableHeaderCell>
                <DataTableHeaderCell
                  align="right"
                  sortKey="size"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Size
                </DataTableHeaderCell>
                <DataTableHeaderCell
                  sortKey="expires_at"
                  activeSort={sort}
                  activeDir={dir}
                  onSort={handleSort}
                >
                  Expiry
                </DataTableHeaderCell>
                <DataTableHeaderCell align="right">Download</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {sortRows(docs.data.items, sort, dir, {
                original_name: (d) => d.original_name,
                size: (d) => d.size,
                expires_at: (d) => (d.expires_at ? Date.parse(d.expires_at) : null),
              }).map((doc) => (
                <DataTableRow key={doc.id}>
                  <DataTableCell className="max-w-[18rem]">
                    <p
                      title={doc.original_name}
                      className="truncate font-medium text-foreground"
                    >
                      {doc.original_name}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {doc.mime_type}
                    </p>
                  </DataTableCell>
                  <DataTableCell>
                    {doc.entity_type && doc.entity_id ? (
                      <StatusDotBadge tone="info">
                        {documentEntityLabels[doc.entity_type]} #{doc.entity_id}
                      </StatusDotBadge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Branch file
                      </span>
                    )}
                  </DataTableCell>
                  <DataTableCell
                    align="right"
                    numeric
                    className="text-muted-foreground"
                  >
                    {formatFileSize(doc.size)}
                  </DataTableCell>
                  <DataTableCell>
                    <ExpiryBadge expiresAt={doc.expires_at} />
                  </DataTableCell>
                  <DataTableCell align="right">
                    <a
                      href={documentDownloadUrl(doc.id)}
                      download={doc.original_name}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-link hover:underline"
                    >
                      <Download className="size-3.5" aria-hidden="true" />
                      Download
                    </a>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </DataTableFrame>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(uploaded, meta) => {
          setNotice(
            meta.requestedExpiry && !uploaded.expires_at
              ? `Uploaded ${uploaded.original_name}. Note: expiry date was not saved by this API version yet.`
              : `Uploaded ${uploaded.original_name}.`,
          );
          void client.invalidateQueries({
            queryKey: [...scope.key, "documents"],
          });
        }}
      />
    </div>
  );
}
