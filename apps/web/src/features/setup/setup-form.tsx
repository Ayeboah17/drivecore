"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import { ApiError, errorText, initializeCsrf, request } from "@/lib/api/client";
import {
  branchSchema,
  companySchema,
  can,
  type Branch,
  type Company,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  branchInput,
  companyInput,
  canCreateBranch,
  canCreateCompany,
  currencyOptions,
  defaultCurrency,
} from "./contracts";

export function SetupForm({
  kind,
  presentation = "panel",
  onPendingChange,
}: {
  kind: "company" | "branch";
  presentation?: "panel" | "dialog";
  onPendingChange?: (pending: boolean) => void;
}) {
  const session = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const prefix = useId();
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<Company | Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const allowed =
    session.user &&
    (kind === "company"
      ? canCreateCompany(session.user)
      : canCreateBranch(session.user, scope.companyId));
  const schema =
    kind === "company"
      ? companyInput
      : branchInput.extend({ currency: z.string() });
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ name: string; currency: string }>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", currency: defaultCurrency },
  });
  if (!allowed)
    return (
      <p role="status">You do not have permission to create this {kind}.</p>
    );
  const companyId = kind === "company" ? created?.id : Number(scope.companyId);
  const destination =
    created && "company_id" in created
      ? `/companies/${created.company_id}/dashboard?branch=${created.id}`
      : `/companies/${companyId}/setup?branch=all`;
  return (
    <section
      className={
        presentation === "dialog"
          ? "space-y-5"
          : "max-w-xl space-y-4 rounded-card border bg-surface p-card"
      }
      aria-label={`Create ${kind}`}
    >
      {presentation !== "dialog" ? (
        <h2 className="text-section-heading">Create {kind}</h2>
      ) : null}
      {created ? (
        <div role="status" className="space-y-3">
          <p>
            {kind === "company" ? "Company" : "Branch"} created:{" "}
            <strong>{created.name}</strong>.
          </p>
          {kind === "branch" && !error ? (
            <Button
              variant="outline"
              disabled={busy || isSubmitting}
              onClick={() => {
                setCreated(null);
                reset({ name: "", currency: defaultCurrency });
                lock.current = false;
              }}
            >
              Create another branch
            </Button>
          ) : null}
          <Link
            className="inline-block text-link"
            href={
              kind === "branch" && !scope.directory?.branchesAvailable
                ? `/companies/${scope.companyId}/dashboard?branch=all`
                : destination
            }
          >
            {kind === "company" ? "Set up branches" : "Open workspace"}
          </Link>
          {kind === "branch" &&
          scope.directory?.branchesAvailable &&
          can(session.user!, "customers.manage") &&
          can(session.user!, "customers.view") ? (
            <Link
              className="ml-4 inline-block text-link"
              href={`/companies/${scope.companyId}/customers/new?branch=${created.id}`}
            >
              Create customer
            </Link>
          ) : null}
          {kind === "branch" &&
          scope.directory?.branchesAvailable &&
          can(session.user!, "vehicles.manage") &&
          can(session.user!, "vehicles.view") ? (
            <Link
              className="ml-4 inline-block text-link"
              href={`/companies/${scope.companyId}/vehicles/new?branch=${created.id}`}
            >
              Create vehicle
            </Link>
          ) : null}
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void handleSubmit(async (values) => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              onPendingChange?.(true);
              setError(null);
              controller.current = new AbortController();
              let saved = false;
              try {
                const payload = await request(
                  `api/v1/${kind === "company" ? "companies" : "branches"}`,
                  {
                    method: "POST",
                    signal: controller.current.signal,
                    body:
                      kind === "company"
                        ? values
                        : {
                            name: values.name,
                            company_id: Number(scope.companyId),
                          },
                  },
                );
                const result = z
                  .object({
                    data: kind === "company" ? companySchema : branchSchema,
                  })
                  .safeParse(payload);
                if (
                  !result.success ||
                  (kind === "branch" &&
                    (!("company_id" in result.data.data) ||
                      result.data.data.company_id !== Number(scope.companyId)))
                )
                  throw new ApiError(
                    502,
                    "Unexpected creation response. Refresh before trying again.",
                  );
                saved = true;
                if (!active.current) return;
                setCreated(result.data.data);
                await client.invalidateQueries(
                  {
                    queryKey: [
                      "live",
                      session.epoch,
                      session.user!.id,
                      "directory",
                    ],
                  },
                  { throwOnError: true },
                );
                if (active.current && kind === "company")
                  scope.navigate(
                    `/companies/${result.data.data.id}/setup?branch=all`,
                  );
              } catch (failure) {
                if (!active.current) return;
                if (failure instanceof ApiError && failure.status === 401)
                  session.expire();
                if (failure instanceof ApiError && failure.status === 422)
                  for (const field of ["name", "currency"] as const)
                    if (failure.fields[field])
                      setFieldError(field, {
                        type: "server",
                        message: failure.fields[field][0],
                      });
                setError(
                  saved
                    ? new Error(
                        "Created successfully, but the directory could not be refreshed. Refresh the directory before continuing; do not submit again.",
                      )
                    : failure,
                );
              } finally {
                if (!saved) lock.current = false;
                if (active.current) setBusy(false);
                if (active.current) onPendingChange?.(false);
              }
            })(event);
          }}
        >
          <fieldset className="space-y-4" disabled={isSubmitting || busy}>
            <div className="space-y-2">
              <label htmlFor={`${prefix}-name`}>
                {kind === "company" ? "Company name" : "Branch name"}
              </label>
              <Input
                id={`${prefix}-name`}
                maxLength={255}
                {...register("name")}
                aria-invalid={!!errors.name}
                aria-describedby={`${prefix}-name-error`}
              />
              <p
                id={`${prefix}-name-error`}
                className="text-sm text-danger-foreground"
              >
                {errors.name?.message}
              </p>
            </div>
            {kind === "company" ? (
              <div className="space-y-2">
                <label htmlFor={`${prefix}-currency`}>Currency</label>
                <select
                  id={`${prefix}-currency`}
                  {...register("currency")}
                  aria-invalid={!!errors.currency}
                  aria-describedby={`${prefix}-currency-error`}
                  className="h-control w-full rounded-control border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                <p
                  id={`${prefix}-currency-error`}
                  className="text-sm text-danger-foreground"
                >
                  {errors.currency?.message}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Company: {scope.company?.name}. Branch names must be unique
                within this company.
              </p>
            )}
            <Button type="submit" disabled={isSubmitting || busy}>
              {isSubmitting || busy ? "Creating…" : `Create ${kind}`}
            </Button>
          </fieldset>
        </form>
      )}
      {error ? (
        <div role="alert" className="space-y-2 text-sm text-danger-foreground">
          <p>{errorText(error)}</p>
          {error instanceof ApiError && error.status === 422 ? (
            <ul>
              {Object.entries(error.fields).map(([field, messages]) => (
                <li key={field}>
                  {field}: {messages.join(" ")}
                </li>
              ))}
            </ul>
          ) : null}
          {created ? (
            <Button variant="outline" onClick={scope.retry}>
              Refresh directory
            </Button>
          ) : error instanceof ApiError && error.status === 419 ? (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await initializeCsrf();
                  setError(
                    new Error(
                      "CSRF protection renewed. Submit again when ready.",
                    ),
                  );
                } catch (failure) {
                  setError(failure);
                }
              }}
            >
              Renew CSRF protection
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
