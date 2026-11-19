import { z } from "zod";
import { humanizeFieldMessage } from "./error-format";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string[]> = {},
    public retryAfter: string | null = null,
  ) {
    super(message);
  }
}
export const errorText = (error: unknown) =>
  error instanceof Error
    ? humanizeFieldMessage(error.message)
    : "The request could not be completed.";
const messages: Record<number, string> = {
  401: "Your session has expired. Sign in again.",
  403: "Access denied or account disabled.",
  404: "This record or context is unavailable.",
  409: "The record changed or its current state prevents this action. Refresh before continuing.",
  419: "Your session needs verification. Renew CSRF protection, then submit again deliberately.",
  426: "A secure HTTPS connection is required.",
  429: "Too many requests. Wait before trying again.",
  502: "The API returned an unexpected response.",
  503: "The API is unavailable or is not configured.",
  504: "The API timed out. A submitted change may have completed. Refresh before trying again.",
};
export function csrfToken(cookie: string) {
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("XSRF-TOKEN="));
  try {
    return value ? decodeURIComponent(value.slice(11)) : "";
  } catch {
    return "";
  }
}
export async function request(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<unknown> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers["X-XSRF-TOKEN"] = csrfToken(document.cookie);
  }
  let response: Response;
  try {
    response = await fetch(`/api/backend/${path}`, {
      method,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      "Connection failed. A submitted change may have completed. Refresh before trying again.",
    );
  }
  if (response.status === 204) return undefined;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z
      .object({
        message: z.string(),
        errors: z.record(z.string(), z.array(z.string())),
      })
      .safeParse(payload);
    throw new ApiError(
      response.status,
      response.status === 422 && parsed.success
        ? parsed.data.message
        : (messages[response.status] ??
            "The service could not complete the request."),
      parsed.success ? parsed.data.errors : {},
      response.headers.get("retry-after"),
    );
  }
  if (payload === null) throw new ApiError(502, messages[502]);
  return payload;
}
export async function uploadForm(
  path: string,
  formData: FormData,
  signal?: AbortSignal,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-XSRF-TOKEN": csrfToken(document.cookie),
  };
  let response: Response;
  try {
    response = await fetch(`/api/backend/${path}`, {
      method: "POST",
      headers,
      credentials: "same-origin",
      cache: "no-store",
      signal,
      body: formData,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      0,
      "Connection failed. Refresh before trying again.",
    );
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z
      .object({
        message: z.string(),
        errors: z.record(z.string(), z.array(z.string())),
      })
      .safeParse(payload);
    throw new ApiError(
      response.status,
      response.status === 422 && parsed.success
        ? parsed.data.message
        : (messages[response.status] ??
            "The service could not complete the request."),
      parsed.success ? parsed.data.errors : {},
      response.headers.get("retry-after"),
    );
  }
  if (payload === null) throw new ApiError(502, messages[502]);
  return payload;
}

export async function read<T extends z.ZodType>(
  path: string,
  schema: T,
  signal?: AbortSignal,
): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await request(path, { signal }));
  if (!parsed.success)
    throw new ApiError(
      502,
      "The API response does not match the supported contract.",
    );
  return parsed.data;
}
export const initializeCsrf = () => request("sanctum/csrf-cookie");
