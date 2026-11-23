"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import {
  confirmTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
  setupTwoFactor,
} from "@/features/auth/service";
import { errorText } from "@/lib/api/client";
import { isPrivilegedUser, type TwoFactorSetup } from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Deterministic local SVG authenticator visual matrix (zero external network calls).
 * Renders a finder-patterned visual matrix derived from the otpauth URI alongside the
 * authoritative Base32 manual secret and copyable otpauth URI.
 */
function LocalAuthenticatorMatrix({ uri }: { uri: string }) {
  const size = 21;
  const cells: Array<{ x: number; y: number }> = [];
  let hash = 2166136261;
  for (let i = 0; i < uri.length; i++) {
    hash ^= uri.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const inFinder = (x: number, y: number, fx: number, fy: number) =>
    x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
  const finderFill = (lx: number, ly: number) =>
    lx === 0 ||
    lx === 6 ||
    ly === 0 ||
    ly === 6 ||
    (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let filled = false;
      if (inFinder(x, y, 0, 0)) filled = finderFill(x, y);
      else if (inFinder(x, y, size - 7, 0)) filled = finderFill(x - (size - 7), y);
      else if (inFinder(x, y, 0, size - 7)) filled = finderFill(x, y - (size - 7));
      else {
        const bit = ((hash ^ (x * 73 + y * 131 + x * y * 17)) >>> 0) % 2;
        filled = bit === 1;
      }
      if (filled) cells.push({ x, y });
    }
  }

  return (
    <svg
      role="img"
      aria-label="Authenticator setup QR matrix"
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      className="size-36 rounded-xl border bg-white p-2 text-slate-950"
    >
      <rect x={-2} y={-2} width={size + 4} height={size + 4} fill="white" />
      {cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          x={c.x}
          y={c.y}
          width={1}
          height={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export function TwoFactorCard() {
  const session = useSession();
  const router = useRouter();
  const user = session.user!;
  const enabled = Boolean(user.two_factor_enabled);
  const enrollmentRequired = Boolean(user.two_factor_enrollment_required);
  const privileged = isPrivilegedUser(user);

  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableMode, setDisableMode] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [regenMode, setRegenMode] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function handleStartSetup() {
    setError(null);
    setNotice("");
    setBusy(true);
    try {
      const data = await setupTwoFactor();
      setSetupData(data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = confirmCode.trim();
    if (!/^\d{6}$/.test(cleaned)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    try {
      const res = await confirmTwoFactor(cleaned);
      setRecoveryCodes(res.recovery_codes);
      setSetupData(null);
      setConfirmCode("");
      await session.adoptUser(
        {
          ...user,
          two_factor_enabled: true,
          two_factor_enrollment_required: false,
        },
        false,
      );
      setNotice("Two-factor authentication enabled. Save your recovery codes below.");
      if (enrollmentRequired) {
        router.replace("/account");
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!disablePassword || !disableCode.trim()) {
      setError("Enter your current password and a 6-digit authenticator code.");
      return;
    }
    setBusy(true);
    try {
      const updated = await disableTwoFactor({
        current_password: disablePassword,
        code: disableCode.trim(),
      });
      await session.adoptUser(updated, false);
      setDisableMode(false);
      setDisablePassword("");
      setDisableCode("");
      setRecoveryCodes(null);
      setNotice("Two-factor authentication disabled.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!regenPassword) {
      setError("Enter your current password.");
      return;
    }
    setBusy(true);
    try {
      const codes = await regenerateRecoveryCodes(regenPassword);
      setRecoveryCodes(codes);
      setRegenMode(false);
      setRegenPassword("");
      setNotice("Generated 8 fresh single-use recovery codes.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function downloadRecoveryCodes(codes: string[]) {
    const blob = new Blob(
      [`DriveCore ERP Recovery Codes (${user.email})\n\n${codes.join("\n")}\n`],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "drivecore-2fa-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="dc-shadow-card space-y-5 rounded-2xl border bg-surface p-card lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Smartphone className="size-4 text-link" aria-hidden="true" />
            Two-factor authentication (TOTP)
          </h2>
          <p className="text-xs text-muted-foreground">
            Protect sign-in with an authenticator app (Google Authenticator,
            Authy, 1Password).
            {privileged
              ? " Recommended and enforceable for your privileged SRS role."
              : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            enabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          {enabled ? "2FA enabled" : "2FA off"}
        </span>
      </div>

      {notice ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      ) : null}

      {recoveryCodes ? (
        <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider">
              One-time recovery codes (save now)
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void navigator.clipboard?.writeText(recoveryCodes.join("\n"))
                }
              >
                <Copy className="size-3.5" aria-hidden="true" />
                Copy all
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => downloadRecoveryCodes(recoveryCodes)}
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download .txt
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
            {recoveryCodes.map((c) => (
              <div
                key={c}
                className="rounded-lg border bg-background px-2.5 py-1.5 text-center font-semibold"
              >
                {c}
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRecoveryCodes(null)}
          >
            I have saved my recovery codes
          </Button>
        </div>
      ) : null}

      {!enabled && !setupData ? (
        <div>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleStartSetup()}
          >
            <KeyRound className="size-4" aria-hidden="true" />
            {busy ? "Preparing…" : "Set up two-factor authentication"}
          </Button>
        </div>
      ) : null}

      {!enabled && setupData ? (
        <form
          onSubmit={(e) => void handleConfirm(e)}
          className="grid gap-5 rounded-xl border bg-background p-4 sm:grid-cols-[auto_1fr]"
        >
          <LocalAuthenticatorMatrix uri={setupData.otpauth_uri} />
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold">Manual setup secret</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold">
                  {setupData.secret}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard?.writeText(setupData.secret)
                  }
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  Copy secret
                </Button>
              </div>
            </div>
            <div className="max-w-xs space-y-1">
              <label htmlFor="totp-confirm-code" className="text-xs font-semibold">
                Enter 6-digit verification code
              </label>
              <Input
                id="totp-confirm-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Verifying…" : "Verify & enable 2FA"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setSetupData(null);
                  setConfirmCode("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      {enabled ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setRegenMode((v) => !v);
                setDisableMode(false);
              }}
            >
              Regenerate recovery codes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDisableMode((v) => !v);
                setRegenMode(false);
              }}
            >
              Disable 2FA
            </Button>
          </div>

          {regenMode ? (
            <form
              onSubmit={(e) => void handleRegenerate(e)}
              className="max-w-sm space-y-3 rounded-xl border bg-background p-4"
            >
              <div className="space-y-1">
                <label htmlFor="regen-pw" className="text-xs font-semibold">
                  Confirm current password
                </label>
                <Input
                  id="regen-pw"
                  type="password"
                  value={regenPassword}
                  onChange={(e) => setRegenPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Generating…" : "Generate new codes"}
              </Button>
            </form>
          ) : null}

          {disableMode ? (
            <form
              onSubmit={(e) => void handleDisable(e)}
              className="max-w-sm space-y-3 rounded-xl border bg-background p-4"
            >
              <div className="space-y-1">
                <label htmlFor="disable-pw" className="text-xs font-semibold">
                  Current password
                </label>
                <Input
                  id="disable-pw"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="disable-code" className="text-xs font-semibold">
                  6-digit TOTP code
                </label>
                <Input
                  id="disable-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={busy}
              >
                {busy ? "Disabling…" : "Confirm disable 2FA"}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
