"use client";
import { useId } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DemoStep } from "./steps";

export function StepForm({
  definition,
  onComplete,
  error,
}: {
  definition: DemoStep;
  onComplete: (values: Record<string, string>) => void;
  error?: string;
}) {
  const prefix = useId();
  const resolver: Resolver<Record<string, string>> = async (values) => {
    const result = definition.schema.safeParse(values);
    return result.success
      ? { values: result.data as Record<string, string>, errors: {} }
      : {
          values: {},
          errors: Object.fromEntries(
            result.error.issues.map((issue) => [
              String(issue.path[0]),
              { type: "validate", message: issue.message },
            ]),
          ),
        };
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, string>>({
    resolver,
    defaultValues: definition.values,
  });
  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit(onComplete)}>
      {definition.fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <label
            htmlFor={`${prefix}-${field.name}`}
            className="text-sm font-medium"
          >
            {field.label}
          </label>
          {field.options ? (
            <select
              id={`${prefix}-${field.name}`}
              {...register(field.name)}
              aria-invalid={!!errors[field.name]}
              aria-describedby={`${prefix}-${field.name}-error`}
              className="h-control w-full rounded-control border border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={`${prefix}-${field.name}`}
              type={field.type ?? "text"}
              inputMode={field.numeric ? "numeric" : undefined}
              autoComplete="off"
              {...register(field.name)}
              aria-invalid={!!errors[field.name]}
              aria-describedby={`${prefix}-${field.name}-error`}
            />
          )}
          <p
            id={`${prefix}-${field.name}-error`}
            className="text-sm text-danger-foreground"
          >
            {errors[field.name]?.message}
          </p>
        </div>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {definition.title}
      </Button>
    </form>
  );
}
