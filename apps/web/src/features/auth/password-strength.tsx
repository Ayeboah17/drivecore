"use client";

import { Check, Circle } from "lucide-react";
import { checkPasswordStrength } from "@/lib/api/contracts";

export function PasswordStrengthHint({ password }: { password: string }) {
  const s = checkPasswordStrength(password);
  const rules = [
    { ok: s.minLength, label: "At least 10 characters" },
    { ok: s.hasLetter, label: "At least one letter" },
    { ok: s.hasNumber, label: "At least one number" },
  ];
  return (
    <ul
      aria-label="Password requirements"
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      {rules.map((r) => (
        <li
          key={r.label}
          className={`inline-flex items-center gap-1 ${
            r.ok ? "font-medium text-emerald-700 dark:text-emerald-400" : ""
          }`}
        >
          {r.ok ? (
            <Check className="size-3" aria-hidden="true" />
          ) : (
            <Circle className="size-2.5 opacity-60" aria-hidden="true" />
          )}
          {r.label}
        </li>
      ))}
    </ul>
  );
}
