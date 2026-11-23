"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  CreateQuotationDialog,
  type QuotationDraftSeed,
} from "@/features/quotations/create-quotation-dialog";
import {
  convertLeadToCustomer,
  createLead,
  listLeads,
  updateLead,
} from "./service";
import { errorText } from "@/lib/api/client";
import {
  canManageLeads,
  formatMoneyMinor,
  leadSourceLabels,
  leadSources,
  leadStageLabels,
  leadStages,
  parseMajorToMinor,
  type Lead,
  type LeadSource,
  type LeadStage,
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
  type StatusDotTone,
} from "@/components/data/data-table";
import { StatePanel } from "@/components/layout/state-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DriveCoreDateField } from "@/components/ui/drivecore-calendar";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function stageTone(stage: LeadStage): StatusDotTone {
  if (stage === "won") return "success";
  if (stage === "proposal_sent" || stage === "qualified") return "info";
  if (stage === "contacted") return "warning";
  if (stage === "lost") return "danger";
  return "neutral";
}

function nextPipelineStage(stage: LeadStage): LeadStage | null {
  if (stage === "new") return "contacted";
  if (stage === "contacted") return "qualified";
  return null;
}

export function LeadsPanel() {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();
  const currency = scope.company?.currency || "ZMW";
  const branchId = scope.branch !== "all" ? scope.branch : undefined;
  const canManage = !!user && canManageLeads(user);

  const [stageFilter, setStageFilter] = useState<LeadStage | "">("");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [markingLost, setMarkingLost] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [quoteSeed, setQuoteSeed] = useState<QuotationDraftSeed | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Create lead form state
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [custType, setCustType] = useState<"individual" | "corporate">(
    "corporate",
  );
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<LeadSource>("corporate_outreach");
  const [requirements, setRequirements] = useState("");
  const [expectedStart, setExpectedStart] = useState(() =>
    new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
  );
  const [expectedDays, setExpectedDays] = useState("7");
  const [estValue, setEstValue] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState(() =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");

  const leadsQuery = useQuery({
    queryKey: [...scope.key, "leads", branchId ?? "all", stageFilter, q],
    queryFn: ({ signal }) =>
      listLeads(
        {
          companyId: scope.companyId,
          branchId,
          stage: stageFilter || undefined,
          q,
        },
        signal,
      ),
  });

  async function refreshLeads() {
    await Promise.all([
      client.invalidateQueries({ queryKey: [...scope.key, "leads"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "customers"] }),
      client.invalidateQueries({ queryKey: [...scope.key, "quotations"] }),
    ]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    if (!contactName.trim()) {
      setErrMsg("Contact name is required.");
      return;
    }
    const estMinor = estValue.trim() ? parseMajorToMinor(estValue) : null;
    if (estValue.trim() && (estMinor === null || estMinor < 0)) {
      setErrMsg("Enter a valid estimated value.");
      return;
    }
    const defaultBranchId =
      scope.branch !== "all"
        ? Number(scope.branch)
        : scope.directory?.branches[0]?.id ?? 1;
    setBusy(true);
    try {
      const created = await createLead({
        company_id: Number(scope.companyId),
        branch_id: defaultBranchId,
        contact_name: contactName.trim(),
        company_name: companyName.trim() || null,
        customer_type: custType,
        email: email.trim() || null,
        phone: phone.trim() || null,
        source,
        vehicle_requirements: requirements.trim() || null,
        expected_start_date: expectedStart || null,
        expected_days: expectedDays ? Number(expectedDays) : null,
        estimated_value_minor: estMinor,
        next_follow_up_at: nextFollowUp || null,
        notes: notes.trim() || null,
      });
      setCreateOpen(false);
      setContactName("");
      setCompanyName("");
      setEmail("");
      setPhone("");
      setRequirements("");
      setEstValue("");
      setNotes("");
      setNotice(
        `Lead "${created.company_name || created.contact_name}" added to CRM pipeline.`,
      );
      await refreshLeads();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvance(lead: Lead, next: LeadStage) {
    setErrMsg(null);
    setBusy(true);
    try {
      await updateLead(lead.id, { stage: next });
      setNotice(
        `Lead "${lead.company_name || lead.contact_name}" moved to ${leadStageLabels[next]}.`,
      );
      await refreshLeads();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkLost(e: React.FormEvent) {
    e.preventDefault();
    if (!markingLost) return;
    setErrMsg(null);
    if (!lostReason.trim()) {
      setErrMsg("Enter a lost reason.");
      return;
    }
    setBusy(true);
    try {
      await updateLead(markingLost.id, {
        stage: "lost",
        lost_reason: lostReason.trim(),
      });
      setNotice(
        `Lead "${markingLost.company_name || markingLost.contact_name}" marked lost.`,
      );
      setMarkingLost(null);
      setLostReason("");
      await refreshLeads();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConvert(lead: Lead) {
    setErrMsg(null);
    setBusy(true);
    try {
      const { customer } = await convertLeadToCustomer(lead.id);
      setNotice(
        `Customer "${customer.name}" ready — complete the quotation below.`,
      );
      const startIso = lead.expected_start_date
        ? `${lead.expected_start_date}T09:00:00Z`
        : undefined;
      const days = lead.expected_days && lead.expected_days > 0 ? lead.expected_days : 3;
      const endIso = startIso
        ? new Date(Date.parse(startIso) + days * 86_400_000).toISOString()
        : undefined;
      setQuoteSeed({
        branchId: String(lead.branch_id),
        customerId: String(customer.id),
        startsAt: startIso,
        endsAt: endIso,
        notes: [lead.vehicle_requirements, lead.notes].filter(Boolean).join(" · "),
      });
      setQuoteOpen(true);
      await refreshLeads();
    } catch (err) {
      setErrMsg(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const items = leadsQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Commercial CRM · Lead-to-Quote Pipeline
          </h2>
          <p className="text-xs text-muted-foreground">
            Track corporate &amp; individual inquiries from qualification to
            one-click customer creation and quotation.
          </p>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New lead
          </Button>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-success bg-success/10 px-4 py-3 text-sm text-success-foreground"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}

      {errMsg ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-danger bg-danger/10 px-4 py-3 text-sm text-danger-foreground"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{errMsg}</span>
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {leadStages.map((st) => {
          const active = stageFilter === st;
          const count = items.filter((l) => l.stage === st).length;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStageFilter(active ? "" : st)}
              className={`rounded-2xl border p-3 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/5"
                  : "bg-surface hover:bg-muted/40"
              }`}
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                {leadStageLabels[st]}
              </p>
              <p className="mt-1 font-mono text-lg font-extrabold tabular-nums">
                {count}
              </p>
            </button>
          );
        })}
      </div>

      <DataSearchForm
        label="Search leads"
        defaultValue={q}
        formKey={q}
        onSubmitQuery={setQ}
        placeholder="Search contact, company, or requirements…"
      />

      {leadsQuery.isLoading ? (
        <DataTableSkeleton columns={7} rows={4} />
      ) : leadsQuery.isError ? (
        <StatePanel title="Could not load CRM leads">
          {errorText(leadsQuery.error)}
        </StatePanel>
      ) : items.length === 0 ? (
        <StatePanel title="No CRM leads yet">
          Add an inbound or corporate fleet inquiry to start tracking the
          Lead-to-Quote pipeline.
        </StatePanel>
      ) : (
        <DataTableFrame ariaLabel="CRM leads pipeline">
          <DataTable>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Lead / Contact</DataTableHeaderCell>
                <DataTableHeaderCell>Source</DataTableHeaderCell>
                <DataTableHeaderCell>Requirements</DataTableHeaderCell>
                <DataTableHeaderCell>Follow-up</DataTableHeaderCell>
                <DataTableHeaderCell align="right">
                  Est. value
                </DataTableHeaderCell>
                <DataTableHeaderCell>Stage</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {items.map((lead) => {
                const next = nextPipelineStage(lead.stage);
                const canConvert =
                  canManage &&
                  lead.stage !== "lost" &&
                  lead.stage !== "won";
                return (
                  <DataTableRow key={lead.id}>
                    <DataTableCell>
                      <div className="text-xs font-semibold">
                        {lead.company_name || lead.contact_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {lead.company_name ? `${lead.contact_name} · ` : ""}
                        {lead.email || lead.phone || lead.customer_type}
                      </div>
                    </DataTableCell>
                    <DataTableCell className="text-xs text-muted-foreground">
                      {leadSourceLabels[lead.source]}
                    </DataTableCell>
                    <DataTableCell className="max-w-xs truncate text-xs">
                      {lead.vehicle_requirements || "—"}
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs">
                      {lead.next_follow_up_at || "—"}
                    </DataTableCell>
                    <DataTableCell align="right" numeric>
                      {lead.estimated_value_minor !== null
                        ? formatMoneyMinor(lead.estimated_value_minor, currency)
                        : "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusDotBadge tone={stageTone(lead.stage)}>
                        {leadStageLabels[lead.stage]}
                      </StatusDotBadge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      {canManage ? (
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {next ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void handleAdvance(lead, next)}
                            >
                              <ArrowRight
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              {leadStageLabels[next]}
                            </Button>
                          ) : null}
                          {canConvert ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleConvert(lead)}
                            >
                              <FileSpreadsheet
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              Convert to quotation
                            </Button>
                          ) : null}
                          {lead.stage !== "lost" && lead.stage !== "won" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => {
                                setMarkingLost(lead);
                                setLostReason("");
                              }}
                            >
                              <XCircle className="size-3.5" aria-hidden="true" />
                              Lost
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" aria-hidden="true" />
              New CRM lead
            </DialogTitle>
            <DialogDescription>
              Capture an inbound or corporate fleet opportunity for follow-up
              and quotation conversion.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="lead-contact" className="text-xs font-semibold">
                  Contact name
                </label>
                <Input
                  id="lead-contact"
                  placeholder="e.g. Kwame Boateng"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="lead-company" className="text-xs font-semibold">
                  Company name (optional)
                </label>
                <Input
                  id="lead-company"
                  placeholder="e.g. GoldCoast Mining Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Account type</label>
                <DriveCoreSelect
                  ariaLabel="Lead account type"
                  value={custType}
                  onValueChange={(v) =>
                    setCustType(v as "individual" | "corporate")
                  }
                  options={[
                    { value: "corporate", label: "Corporate account" },
                    { value: "individual", label: "Individual" },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Lead source</label>
                <DriveCoreSelect
                  ariaLabel="Lead source"
                  value={source}
                  onValueChange={(v) => setSource(v as LeadSource)}
                  options={leadSources.map((s) => ({
                    value: s,
                    label: leadSourceLabels[s],
                  }))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="lead-email" className="text-xs font-semibold">
                  Email
                </label>
                <Input
                  id="lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="lead-phone" className="text-xs font-semibold">
                  Phone
                </label>
                <Input
                  id="lead-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="lead-req" className="text-xs font-semibold">
                Fleet requirements
              </label>
              <Input
                id="lead-req"
                placeholder="e.g. 3× 4x4 pickups for 30-day mine site contract"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <DriveCoreDateField
                label="Expected start"
                value={expectedStart}
                onChange={setExpectedStart}
              />
              <div className="space-y-1">
                <label htmlFor="lead-days" className="text-xs font-semibold">
                  Est. days
                </label>
                <Input
                  id="lead-days"
                  inputMode="numeric"
                  value={expectedDays}
                  onChange={(e) => setExpectedDays(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="lead-val" className="text-xs font-semibold">
                  Est. value ({currency})
                </label>
                <Input
                  id="lead-val"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={estValue}
                  onChange={(e) => setEstValue(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DriveCoreDateField
                label="Next follow-up"
                value={nextFollowUp}
                onChange={setNextFollowUp}
              />
              <div className="space-y-1">
                <label htmlFor="lead-notes" className="text-xs font-semibold">
                  Notes
                </label>
                <Input
                  id="lead-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save lead"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!markingLost}
        onOpenChange={(o) => !o && setMarkingLost(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark lead lost</DialogTitle>
            <DialogDescription>
              Record why{" "}
              {markingLost?.company_name || markingLost?.contact_name} did not
              convert.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleMarkLost(e)} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="lost-reason" className="text-xs font-semibold">
                Lost reason
              </label>
              <Textarea
                id="lost-reason"
                rows={3}
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="e.g. Price exceeded budget / chose competitor"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMarkingLost(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={busy}>
                {busy ? "Saving…" : "Confirm lost"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <CreateQuotationDialog
        open={quoteOpen}
        onOpenChange={(o) => {
          setQuoteOpen(o);
          if (!o) setQuoteSeed(null);
        }}
        initialValues={quoteSeed ?? undefined}
        onCreated={(created) => {
          setNotice(
            `Quotation #${created.id} created from lead and ready for customer acceptance.`,
          );
          void refreshLeads();
        }}
      />
    </div>
  );
}
