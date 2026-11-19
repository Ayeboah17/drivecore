"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { ApiError, errorText, initializeCsrf } from "@/lib/api/client";
import {
  humanizeFieldLabel,
  humanizeFieldMessage,
} from "@/lib/api/error-format";
import {
  documentEntityLabels,
  documentEntityTypes,
  type DocumentEntityType,
  type DocumentRecord,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreDateTimeField } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import {
  ALLOWED_DOCUMENT_MIMES,
  MAX_DOCUMENT_BYTES,
  formatFileSize,
  uploadDocument,
} from "./service";

function UploadDocumentForm({
  fixedBranchId,
  fixedEntityType,
  fixedEntityId,
  onBusyChange,
  onCancel,
  onUploaded,
}: {
  fixedBranchId?: number;
  fixedEntityType?: DocumentEntityType;
  fixedEntityId?: number;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onUploaded: (doc: DocumentRecord, meta: { requestedExpiry: boolean }) => void;
}) {
  const scope = useLiveContext();
  const session = useSession();
  const formId = useId();
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);

  const companyBranches =
    scope.directory?.branches.filter(
      (b) => String(b.company_id) === scope.companyId,
    ) ?? [];
  const defaultBranch = fixedBranchId
    ? String(fixedBranchId)
    : scope.branch !== "all"
      ? scope.branch
      : companyBranches.length === 1
        ? String(companyBranches[0].id)
        : "";

  const [branchId, setBranchId] = useState(defaultBranch);
  const [entityType, setEntityType] = useState<DocumentEntityType | "">(
    fixedEntityType ?? "",
  );
  const [entityId, setEntityId] = useState(
    fixedEntityId ? String(fixedEntityId) : "",
  );
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    return () => {
      controller.current?.abort();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!branchId) {
      setError(new Error("Select a branch for this document."));
      return;
    }
    if (!file) {
      setError(new Error("Select a PDF, JPG, or PNG file to upload."));
      return;
    }
    if (
      !ALLOWED_DOCUMENT_MIMES.includes(
        file.type as (typeof ALLOWED_DOCUMENT_MIMES)[number],
      )
    ) {
      setError(new Error("Only PDF, JPG, and PNG files are supported."));
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(new Error("File must be 10 MB or smaller."));
      return;
    }
    if (entityType && (!/^[1-9]\d*$/.test(entityId.trim()))) {
      setError(new Error("Enter a valid positive record ID to link."));
      return;
    }

    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    controller.current = new AbortController();
    try {
      const uploaded = await uploadDocument(
        {
          companyId: Number(scope.companyId),
          branchId: Number(branchId),
          file,
          entityType: entityType || undefined,
          entityId: entityType ? Number(entityId) : undefined,
          expiresAt: expiresAt || undefined,
        },
        controller.current.signal,
      );
      onUploaded(uploaded, { requestedExpiry: !!expiresAt });
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        session.expire();
      }
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form
      noValidate
      aria-busy={busy}
      className="space-y-4"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-file`} className="text-sm font-medium">
            Document file (PDF, JPG, or PNG, max 10 MB)
          </label>
          <Input
            id={`${formId}-file`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
          {file ? (
            <p className="font-mono text-xs text-muted-foreground">
              Selected: {file.name} ({formatFileSize(file.size)})
            </p>
          ) : null}
        </div>

        {!fixedBranchId ? (
          <div className="space-y-1.5">
            <label htmlFor={`${formId}-branch`} className="text-sm font-medium">
              Branch
            </label>
            <DriveCoreSelect
              id={`${formId}-branch`}
              value={branchId}
              onValueChange={setBranchId}
              placeholder="Select a branch"
              options={[
                { value: "", label: "Select a branch" },
                ...companyBranches.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                })),
              ]}
            />
          </div>
        ) : null}

        {!fixedEntityType ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-entity-type`}
                className="text-sm font-medium"
              >
                Link record type (optional)
              </label>
              <DriveCoreSelect
                id={`${formId}-entity-type`}
                value={entityType}
                onValueChange={(val) => {
                  setEntityType(val as DocumentEntityType | "");
                  if (!val) setEntityId("");
                }}
                options={[
                  { value: "", label: "Unlinked branch file" },
                  ...documentEntityTypes.map((t) => ({
                    value: t,
                    label: documentEntityLabels[t],
                  })),
                ]}
              />
            </div>

            {entityType ? (
              <div className="space-y-1.5">
                <label
                  htmlFor={`${formId}-entity-id`}
                  className="text-sm font-medium"
                >
                  {documentEntityLabels[entityType]} ID
                </label>
                <Input
                  id={`${formId}-entity-id`}
                  inputMode="numeric"
                  placeholder="e.g. 10"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor={`${formId}-expires`} className="text-sm font-medium">
            Expiry date (optional)
          </label>
          <DriveCoreDateTimeField
            id={`${formId}-expires`}
            label="Expiry date"
            value={expiresAt}
            onChange={setExpiresAt}
            optional
          />
        </div>
      </fieldset>

      {error ? (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger-foreground"
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
          {error instanceof ApiError && error.status === 419 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await initializeCsrf();
                  setError(
                    new Error("CSRF protection renewed. Submit again."),
                  );
                } catch (csrfErr) {
                  setError(csrfErr);
                }
              }}
            >
              Renew CSRF protection
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Uploading…" : "Upload document"}
        </Button>
      </div>
    </form>
  );
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  fixedBranchId,
  fixedEntityType,
  fixedEntityId,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fixedBranchId?: number;
  fixedEntityType?: DocumentEntityType;
  fixedEntityId?: number;
  onUploaded: (doc: DocumentRecord, meta: { requestedExpiry: boolean }) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-card sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4 text-link" aria-hidden="true" />
            Upload document
          </DialogTitle>
          <DialogDescription>
            Store a PDF or image privately in object storage
            {fixedEntityType && fixedEntityId
              ? ` linked to ${documentEntityLabels[fixedEntityType]} #${fixedEntityId}`
              : ""}
            .
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <UploadDocumentForm
            fixedBranchId={fixedBranchId}
            fixedEntityType={fixedEntityType}
            fixedEntityId={fixedEntityId}
            onBusyChange={setBusy}
            onCancel={() => onOpenChange(false)}
            onUploaded={(doc, meta) => {
              onOpenChange(false);
              onUploaded(doc, meta);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
