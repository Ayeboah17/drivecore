"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useLiveContext } from "@/features/live/context";
import {
  getCompanyMailSettings,
  testCompanyMailSettings,
  updateCompanyMailSettings,
} from "@/features/users/service";
import { ApiError, errorText } from "@/lib/api/client";
import {
  mailEncryptions,
  type CompanyMailSettings,
  type MailEncryption,
  type MailProvider,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface ProviderGuide {
  id: MailProvider;
  label: string;
  host: string;
  port: number;
  encryption: MailEncryption;
  usernameHint: string;
  passwordLabel: string;
  steps: string[];
}

const PROVIDER_GUIDES: ProviderGuide[] = [
  {
    id: "google_workspace",
    label: "Google Workspace / Gmail",
    host: "smtp.gmail.com",
    port: 587,
    encryption: "tls",
    usernameHint: "invitations@yourcompany.com",
    passwordLabel: "16-character Google App Password",
    steps: [
      "Sign in to the Google account you want to send invitations from and open Google Account → Security.",
      "Turn on 2-Step Verification (required before Google allows SMTP App Passwords).",
      "Search for 'App passwords', create a new app named 'DriveCore ERP', and copy the 16-character password.",
      "Use host smtp.gmail.com, port 587, encryption TLS (STARTTLS), your full Gmail/Workspace email as Username, and paste the App Password below.",
    ],
  },
  {
    id: "microsoft_365",
    label: "Microsoft 365 / Outlook",
    host: "smtp.office365.com",
    port: 587,
    encryption: "tls",
    usernameHint: "admin@yourcompany.com",
    passwordLabel: "Mailbox password or App Password",
    steps: [
      "Open Microsoft 365 Admin Center → Users → Active users → select the sending mailbox → Mail → Manage email apps.",
      "Ensure 'Authenticated SMTP' is enabled for this mailbox (Microsoft disables it by default on new tenants).",
      "If MFA is enforced on the account, generate an App Password in Security Info (or use a dedicated shared/service account with SMTP AUTH enabled).",
      "Use host smtp.office365.com, port 587, encryption TLS, and set From Address to match the authenticated mailbox.",
    ],
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    host: "smtp.zoho.com",
    port: 587,
    encryption: "tls",
    usernameHint: "notifications@yourcompany.com",
    passwordLabel: "Zoho App-Specific Password",
    steps: [
      "Sign in to Zoho Mail → Settings → Mail Accounts → verify SMTP Access is enabled.",
      "If 2FA is active, go to accounts.zoho.com → Security → App Passwords → Generate New Password for 'DriveCore'.",
      "Use host smtp.zoho.com (or smtp.zoho.eu / smtp.zoho.in for regional data centers), port 587, encryption TLS.",
      "Set From Address to your verified Zoho domain email address.",
    ],
  },
  {
    id: "resend",
    label: "Resend (Recommended for Transactional)",
    host: "smtp.resend.com",
    port: 587,
    encryption: "tls",
    usernameHint: "resend",
    passwordLabel: "Resend API Key (re_...)",
    steps: [
      "Create a free or paid account at resend.com and verify your sending domain (add the DNS SPF & DKIM records Resend shows).",
      "Go to API Keys → Create API Key with 'Sending access' permission and copy the key starting with re_.",
      "Use host smtp.resend.com, port 587, encryption TLS, Username literally 'resend', and paste your API key as the password.",
      "Set From Address to any address on your verified domain (e.g. noreply@yourcompany.com).",
    ],
  },
  {
    id: "sendgrid",
    label: "SendGrid",
    host: "smtp.sendgrid.net",
    port: 587,
    encryption: "tls",
    usernameHint: "apikey",
    passwordLabel: "SendGrid API Key (SG....)",
    steps: [
      "In SendGrid, go to Settings → Sender Authentication and authenticate your domain (or verify a Single Sender).",
      "Go to Settings → API Keys → Create API Key with 'Mail Send' permission.",
      "Use host smtp.sendgrid.net, port 587, encryption TLS, Username literally 'apikey', and paste your SG... key as the password.",
      "Set From Address to your authenticated domain or verified sender email.",
    ],
  },
  {
    id: "postmark",
    label: "Postmark",
    host: "smtp.postmarkapp.com",
    port: 587,
    encryption: "tls",
    usernameHint: "Server API Token",
    passwordLabel: "Server API Token",
    steps: [
      "In Postmark, create a Server and verify your Sender Signature / domain DKIM & Return-Path DNS records.",
      "Open your Server → API Tokens and copy the Server API Token.",
      "Use host smtp.postmarkapp.com, port 587, encryption TLS, and paste the Server API Token into BOTH Username and Password.",
      "Set From Address to your verified Sender Signature email.",
    ],
  },
  {
    id: "custom_smtp",
    label: "Custom SMTP Server",
    host: "",
    port: 587,
    encryption: "tls",
    usernameHint: "smtp-user@yourcompany.com",
    passwordLabel: "SMTP Password",
    steps: [
      "Obtain the outgoing SMTP hostname, port (usually 587 for STARTTLS or 465 for SSL), and credentials from your IT administrator or hosting panel (cPanel, Mailgun, Amazon SES, etc.).",
      "Ensure SPF and DKIM DNS records are configured for your From Address domain so invitation emails do not land in spam.",
      "Save your settings and click 'Send test email' below to verify the SMTP handshake.",
    ],
  },
];

function EmailSettingsForm({
  initial,
  canEdit,
  notice,
  onSaved,
}: {
  initial: CompanyMailSettings;
  canEdit: boolean;
  notice: string;
  onSaved: (message?: string) => void;
}) {
  const scope = useLiveContext();
  const [provider, setProvider] = useState<MailProvider>(initial.provider);
  const [host, setHost] = useState(initial.host || "smtp.gmail.com");
  const [port, setPort] = useState(String(initial.port || 587));
  const [encryption, setEncryption] = useState<MailEncryption>(
    initial.encryption || "tls",
  );
  const [username, setUsername] = useState(initial.username ?? "");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState(
    initial.from_name || scope.company?.name || "DriveCore ERP",
  );
  const [fromAddress, setFromAddress] = useState(initial.from_address || "");
  const [isEnabled, setIsEnabled] = useState(Boolean(initial.is_enabled));
  const [guideOpen, setGuideOpen] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const activeGuide =
    PROVIDER_GUIDES.find((g) => g.id === provider) ?? PROVIDER_GUIDES[0];

  function handleProviderChange(next: MailProvider) {
    setProvider(next);
    const preset = PROVIDER_GUIDES.find((g) => g.id === next);
    if (preset && preset.id !== "custom_smtp") {
      setHost(preset.host);
      setPort(String(preset.port));
      setEncryption(preset.encryption);
      if (preset.id === "resend") setUsername("resend");
      else if (preset.id === "sendgrid") setUsername("apikey");
    }
    setGuideOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || saving) return;
    const portNum = Number(port);
    if (!host.trim()) {
      setSaveError("SMTP host is required.");
      return;
    }
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setSaveError("Enter a valid SMTP port between 1 and 65535.");
      return;
    }
    if (!fromAddress.trim() || !fromAddress.includes("@")) {
      setSaveError("Enter a valid From Email address.");
      return;
    }

    setSaving(true);
    setSaveError("");
    const ac = new AbortController();
    try {
      await updateCompanyMailSettings(
        scope.companyId,
        {
          provider,
          host: host.trim(),
          port: portNum,
          encryption,
          username: username.trim() || null,
          ...(password.trim() ? { password: password.trim() } : {}),
          from_name: fromName.trim() || scope.company?.name || "DriveCore ERP",
          from_address: fromAddress.trim(),
          is_enabled: isEnabled,
        },
        ac.signal,
      );
      setPassword("");
      onSaved("Email & SMTP settings saved securely.");
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || testing) return;
    const target = testEmail.trim();
    if (!target || !target.includes("@")) {
      setTestResult({ ok: false, message: "Enter a valid recipient email." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const ac = new AbortController();
    try {
      const res = await testCompanyMailSettings(
        scope.companyId,
        target,
        ac.signal,
      );
      setTestResult({ ok: res.ok, message: res.message });
      onSaved();
    } catch (err) {
      setTestResult({ ok: false, message: errorText(err) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="max-w-2xl space-y-5 rounded-2xl border bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Mail className="size-4 text-primary" aria-hidden="true" />
            Email &amp; Invitations (SMTP Setup)
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure the outgoing email server DriveCore uses to send user
            invitations and account notifications for this company.
          </p>
        </div>
        {initial.last_test_status ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              initial.last_test_status === "passed"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            <CheckCircle2 className="size-3" aria-hidden="true" />
            Last test: {initial.last_test_status}
          </span>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          void handleSave(e);
        }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
            <Checkbox
              checked={isEnabled}
              disabled={!canEdit}
              onCheckedChange={(checked) => setIsEnabled(Boolean(checked))}
            />
            Use custom company SMTP for invitations &amp; alerts
          </label>
          <span className="text-xs text-muted-foreground">
            {isEnabled ? "Active" : "Using platform default"}
          </span>
        </div>

        <div className="space-y-1.5">
          <Label>Email provider</Label>
          <DriveCoreSelect
            ariaLabel="Email provider"
            value={provider}
            disabled={!canEdit}
            onValueChange={(v) => handleProviderChange(v as MailProvider)}
            options={PROVIDER_GUIDES.map((g) => ({
              value: g.id,
              label: g.label,
            }))}
          />
        </div>

        {/* Provider-specific step-by-step setup guide */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs">
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left font-semibold text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-primary" aria-hidden="true" />
              How to set up {activeGuide.label}
            </span>
            {guideOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
          </button>
          {guideOpen ? (
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-muted-foreground">
              {activeGuide.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="smtp-host">SMTP host</Label>
            <Input
              id="smtp-host"
              disabled={!canEdit}
              placeholder="smtp.gmail.com"
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-port">Port</Label>
            <Input
              id="smtp-port"
              type="number"
              min={1}
              max={65535}
              disabled={!canEdit}
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Encryption</Label>
            <DriveCoreSelect
              ariaLabel="SMTP encryption"
              value={encryption}
              disabled={!canEdit}
              onValueChange={(v) => setEncryption(v as MailEncryption)}
              options={mailEncryptions.map((enc) => ({
                value: enc,
                label:
                  enc === "tls"
                    ? "TLS (STARTTLS — Port 587)"
                    : enc === "ssl"
                      ? "SSL / SMTPS — Port 465"
                      : "None (Unencrypted)",
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-username">SMTP username</Label>
            <Input
              id="smtp-username"
              disabled={!canEdit}
              placeholder={activeGuide.usernameHint}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="smtp-password">{activeGuide.passwordLabel}</Label>
          <Input
            id="smtp-password"
            type="password"
            autoComplete="new-password"
            disabled={!canEdit}
            placeholder={
              initial.has_password
                ? "•••••••••••• (saved — leave blank to keep)"
                : "Enter SMTP password or API key"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" aria-hidden="true" />
            Stored encrypted on the server (write-only; never returned to the
            browser).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="smtp-from-name">From name</Label>
            <Input
              id="smtp-from-name"
              disabled={!canEdit}
              placeholder="DriveCore Fleet Operations"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-from-address">From email address</Label>
            <Input
              id="smtp-from-address"
              type="email"
              disabled={!canEdit}
              placeholder="invitations@yourcompany.com"
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
            />
          </div>
        </div>

        {saveError ? (
          <p role="alert" className="text-xs text-danger-foreground">
            {saveError}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {notice}
          </p>
        ) : null}

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              <Save className="mr-1.5 size-4" aria-hidden="true" />
              {saving ? "Saving…" : "Save email settings"}
            </Button>
          </div>
        ) : null}
      </form>

      {canEdit ? (
        <form
          onSubmit={(e) => {
            void handleSendTest(e);
          }}
          className="space-y-2.5 border-t pt-4"
        >
          <Label htmlFor="smtp-test-recipient">
            Verify delivery (Send test invitation email)
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="smtp-test-recipient"
              type="email"
              placeholder="you@yourcompany.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={testing}>
              <Send className="mr-1.5 size-3.5" aria-hidden="true" />
              {testing ? "Testing…" : "Send test email"}
            </Button>
          </div>
          {testResult ? (
            <p
              role={testResult.ok ? "status" : "alert"}
              className={`text-xs font-medium ${
                testResult.ok
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-danger-foreground"
              }`}
            >
              {testResult.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}

export function EmailSettingsCard({ canEdit }: { canEdit: boolean }) {
  const scope = useLiveContext();
  const client = useQueryClient();
  const [notice, setNotice] = useState("");

  const query = useQuery({
    queryKey: [...scope.key, "company-mail-settings"],
    queryFn: ({ signal }) => getCompanyMailSettings(scope.companyId, signal),
    enabled: !!scope.companyId && canEdit,
    retry: false,
  });

  if (!canEdit) return null;

  if (query.isPending) {
    return <Skeleton className="h-56 max-w-2xl rounded-2xl" />;
  }

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <section className="max-w-2xl rounded-2xl border bg-surface p-5 text-xs text-muted-foreground">
        Company SMTP &amp; email settings are not enabled on this API server
        yet.
      </section>
    );
  }

  if (query.error || !query.data) {
    return (
      <section className="max-w-2xl rounded-2xl border bg-surface p-5 text-xs text-danger-foreground">
        {errorText(query.error)}
      </section>
    );
  }

  return (
    <EmailSettingsForm
      key={`${query.data.company_id}:${query.data.provider}:${query.data.host}:${query.data.port}:${query.data.has_password}:${query.data.is_enabled}`}
      initial={query.data}
      canEdit={canEdit}
      notice={notice}
      onSaved={(msg) => {
        if (msg) setNotice(msg);
        void client.invalidateQueries({
          queryKey: [...scope.key, "company-mail-settings"],
        });
      }}
    />
  );
}
