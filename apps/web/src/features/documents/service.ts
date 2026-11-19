import { z } from "zod";
import { ApiError, read, uploadForm } from "@/lib/api/client";
import {
  documentSchema,
  normalizePage,
  pageSchema,
  type DocumentEntityType,
  type DocumentRecord,
} from "@/lib/api/contracts";

export const ALLOWED_DOCUMENT_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function documentExpiryState(
  expiresAt: string | null,
): "expired" | "expiring" | "valid" | null {
  if (!expiresAt) return null;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return null;
  const now = Date.now();
  if (ts < now) return "expired";
  if (ts - now <= 30 * 86400000) return "expiring";
  return "valid";
}

export function documentDownloadUrl(id: number): string {
  return `/api/backend/api/v1/documents/${id}`;
}

export async function listDocuments(
  params: {
    companyId: string;
    branch: string;
    entityType?: string;
    entityId?: number;
    q?: string;
    page?: number;
  },
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ company_id: params.companyId });
  if (params.branch !== "all") query.set("branch_id", params.branch);
  if (params.entityType) {
    query.set("entity_type", params.entityType);
    if (params.entityId) query.set("entity_id", String(params.entityId));
  }
  const trimmedQ = (params.q ?? "").trim().slice(0, 100);
  if (trimmedQ) query.set("q", trimmedQ);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const payload = await read(
    `api/v1/documents?${query.toString()}`,
    pageSchema(documentSchema),
    signal,
  );
  const normalized = normalizePage(payload);
  for (const item of normalized.items) {
    if (
      String(item.company_id) !== params.companyId ||
      (params.branch !== "all" && String(item.branch_id) !== params.branch)
    ) {
      throw new ApiError(
        502,
        "Unexpected document scope returned by the API.",
      );
    }
  }
  return normalized as {
    items: DocumentRecord[];
    page: number;
    lastPage: number;
    pageSize: number;
    total: number;
  };
}

export async function uploadDocument(
  params: {
    companyId: number;
    branchId: number;
    file: File;
    entityType?: DocumentEntityType | "";
    entityId?: number;
    expiresAt?: string;
  },
  signal: AbortSignal,
): Promise<DocumentRecord> {
  if (
    !ALLOWED_DOCUMENT_MIMES.includes(
      params.file.type as (typeof ALLOWED_DOCUMENT_MIMES)[number],
    )
  ) {
    throw new ApiError(422, "Only PDF, JPG, and PNG files are supported.", {
      file: ["Only PDF, JPG, and PNG files are supported."],
    });
  }
  if (params.file.size > MAX_DOCUMENT_BYTES) {
    throw new ApiError(422, "File exceeds the 10 MB upload limit.", {
      file: ["File must be 10 MB or smaller."],
    });
  }
  const form = new FormData();
  form.append("company_id", String(params.companyId));
  form.append("branch_id", String(params.branchId));
  form.append("file", params.file);
  if (params.entityType && params.entityId) {
    form.append("entity_type", params.entityType);
    form.append("entity_id", String(params.entityId));
  }
  if (params.expiresAt) {
    form.append("expires_at", new Date(params.expiresAt).toISOString());
  }
  const payload = await uploadForm("api/v1/documents", form, signal);
  const parsed = z.object({ data: documentSchema }).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      502,
      "Unexpected upload response. Refresh to verify whether the file saved.",
    );
  }
  return parsed.data.data;
}
