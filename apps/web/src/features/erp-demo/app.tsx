"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { navigation } from "@/lib/navigation/definitions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { StatePanel } from "@/components/layout/state-panel";
import {
  entities,
  type Entity,
  type Kind,
  type Command,
} from "@/lib/demo/types";
import {
  allowed,
  authorizedContext,
  companyOptions,
  branchOptions,
  inScope,
  kindModule,
  type Module,
} from "@/lib/demo/permissions";
import { label } from "@/lib/demo/selectors";
import { DemoProvider, useDemo } from "./provider";
import { DemoForm, selectClass } from "./form";
import {
  screens,
  moduleScreens,
  entityName,
  type WorkflowAction,
} from "./config";
import { RecordTable } from "./table";
import { Overview, Reports } from "./overview";
import { Detail } from "./detail";
import { PrototypeShell } from "./shell";
import { DemoEntry } from "./entry";
import { ModuleMetrics } from "./metrics";
import "./demo.css";
function safeCompanies(
  db: Parameters<typeof companyOptions>[0],
  userId: string,
) {
  try {
    return companyOptions(db, userId);
  } catch {
    return [];
  }
}

interface Modal {
  title: string;
  description: string;
  record?: Entity;
  kind?: Kind;
  workflow?: WorkflowAction;
  remove?: boolean;
  token: string;
}
function Workspace() {
  const { db, execute, reset, busy, notice, clearNotice } = useDemo(),
    params = useSearchParams();
  const [resetOpen, setResetOpen] = useState(false),
    [resetBusy, setResetBusy] = useState(false),
    [modal, setModal] = useState<Modal | null>(null),
    [formBusy, setFormBusy] = useState(false),
    [resetError, setResetError] = useState("");
  const dark = params.get("theme") === "dark";
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const userId = params.get("user") ?? "user-platform",
    companyId = params.get("company") ?? safeCompanies(db, userId)[0]?.id ?? "",
    branchId = params.get("branch") ?? "all";
  const ctx = { userId, companyId, branchId },
    view = params.get("view") ?? "dashboard",
    available = moduleScreens[view] ?? [],
    tab = (
      available.includes(params.get("tab") as Kind)
        ? params.get("tab")
        : available[0]
    ) as Kind | undefined,
    id = params.get("id") ?? "";
  const token = `${userId}:${companyId}:${branchId}:${view}:${tab}:${id}`,
    currentToken = useRef(token),
    main = useRef<HTMLElement>(null);
  useEffect(() => {
    currentToken.current = token;
    main.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [token]);
  const range = { from: params.get("from") ?? "", to: params.get("to") ?? "" };
  function go(values: Record<string, string>, replace = false) {
    const p = new URLSearchParams(params);
    if (values.view || values.tab) {
      p.delete("sort");
      p.delete("ledger");
    }
    for (const [key, value] of Object.entries(values))
      if (value) p.set(key, value);
      else p.delete(key);
    const url = `/demo/erp?${p}`;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    setModal(null);
  }
  function open(e: Entity) {
    go({
      view: kindModule[e.kind],
      tab: e.kind,
      id: e.id,
      q: "",
      filter: "",
      page: "1",
    });
  }
  const user = entities(db, "user").find((u) => u.id === userId),
    company = entities(db, "company").find((c) => c.id === companyId);
  let contextError = "";
  try {
    authorizedContext(db, ctx);
  } catch (error) {
    contextError =
      error instanceof Error ? error.message : "Context unavailable.";
  }
  const branches = contextError ? [] : branchOptions(db, ctx);
  const resetDialog = (
    <Dialog
      open={resetOpen}
      onOpenChange={(open) => {
        if (!resetBusy) setResetOpen(open);
      }}
    >
      <DialogContent
        showCloseButton={!resetBusy}
        className="rounded-card p-card motion-reduce:duration-0 motion-reduce:animate-none motion-reduce:transition-none"
      >
        <DialogHeader>
          <DialogTitle>Restore the seeded demo?</DialogTitle>
          <DialogDescription>
            This replaces all full-prototype demo records in this browser with
            the original fictional dataset. Live records and the separate setup
            walkthrough are unaffected.
          </DialogDescription>
        </DialogHeader>
        {resetError ? (
          <p role="alert" className="text-danger-foreground">
            {resetError}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            disabled={resetBusy}
            onClick={() => setResetOpen(false)}
          >
            Keep changes
          </Button>
          <Button
            disabled={resetBusy}
            onClick={async () => {
              setResetBusy(true);
              setResetError("");
              try {
                await reset();
                setResetOpen(false);
                go({
                  demo: "1",
                  user: "user-platform",
                  company: "co-1",
                  branch: "all",
                  view: "dashboard",
                  tab: "",
                  id: "",
                  q: "",
                  filter: "",
                  page: "1",
                });
              } catch (error) {
                setResetError(
                  error instanceof Error
                    ? error.message
                    : "Reset failed; existing records are unchanged.",
                );
              } finally {
                setResetBusy(false);
              }
            }}
          >
            {resetBusy ? "Restoring…" : "Restore demo data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  if (params.get("demo") !== "1")
    return (
      <>
        <DemoEntry
          db={db}
          onReset={() => setResetOpen(true)}
          onEnter={(selected) => {
            const companies = companyOptions(db, selected);
            go({
              demo: "1",
              user: selected,
              company: companies[0]?.id ?? "",
              branch: "all",
              view: "dashboard",
            });
          }}
        />
        {resetDialog}
      </>
    );
  const isModule = navigation.some((n) => n.key === view),
    permitted = isModule && allowed(db, ctx, view as Module);
  const screen = tab ? screens[tab] : null,
    record = id
      ? db.entities.find((e) => e.id === id && e.kind === tab)
      : undefined;
  const validRecord =
    record &&
    inScope(db, ctx, record) &&
    allowed(db, ctx, kindModule[record.kind]);
  const moduleTitle = navigation.find((n) => n.key === view)?.label ?? "Module";
  const creatingAllowed =
    screen?.fields &&
    tab &&
    allowed(db, ctx, kindModule[tab], true) &&
    !(
      view === "administration" &&
      ["company", "role"].includes(tab) &&
      !entities(db, "role")
        .find((r) => r.id === user?.roleId)
        ?.permissions.includes("*")
    );
  function create() {
    if (!tab) return;
    setModal({
      title: `Create ${entityName(tab!)}`,
      description: screen?.description ?? "",
      kind: tab,
      token,
    });
  }
  return (
    <PrototypeShell
      db={db}
      ctx={ctx}
      view={view}
      busy={busy}
      dark={dark}
      onNavigate={go}
      onReset={() => setResetOpen(true)}
    >
      <main
        id="erp-main"
        ref={main}
        tabIndex={-1}
        className="space-y-6 p-page outline-none"
        key={`${userId}:${companyId}:${branchId}`}
      >
        <div
          role="status"
          aria-live="polite"
          className={`demo-feedback fixed inset-x-4 bottom-4 z-40 flex min-h-control items-center justify-between gap-3 rounded-control border bg-surface px-3 py-2 text-sm shadow-sm sm:left-auto sm:w-[28rem] ${notice ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
        >
          <span>{notice}</span>
          <button
            aria-label="Dismiss feedback"
            disabled={!notice}
            tabIndex={notice ? 0 : -1}
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            onClick={clearNotice}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {contextError ? (
          <StatePanel title="Demo context unavailable">
            {contextError} Use the selectors to choose an accessible company and
            branch.
          </StatePanel>
        ) : range.from && range.to && range.from > range.to ? (
          <StatePanel title="Invalid date range">
            Choose a From date before the To date, or clear the dates.
          </StatePanel>
        ) : !permitted ? (
          <StatePanel title="Demo access denied">
            The selected account cannot open this module. Switch to an account
            with the required capability.
          </StatePanel>
        ) : view !== "administration" &&
          !entities(db, "branch").some((b) => b.companyId === ctx.companyId) ? (
          <StatePanel title="Set up your first branch">
            This company needs a branch before operational records can be
            created.{" "}
            {allowed(db, ctx, "administration", true) ? (
              <Button
                className="mt-3"
                onClick={() =>
                  go({ view: "administration", tab: "branch", id: "" })
                }
              >
                Set up branches
              </Button>
            ) : (
              "Ask a demo administrator to create a branch."
            )}
          </StatePanel>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 tabIndex={-1} className="text-page-title outline-none">
                  {moduleTitle}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {company?.name} ·{" "}
                  {branchId === "all"
                    ? "All accessible branches"
                    : branches.find((b) => b.id === branchId)?.name}{" "}
                  · Synthetic demo data
                </p>
                <p className="max-w-3xl text-label text-muted-foreground">
                  {
                    entities(db, "setting").find(
                      (s) =>
                        s.companyId === ctx.companyId &&
                        s.name === "Workspace note",
                    )?.value
                  }
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["dashboard", "operations"].includes(view) &&
                allowed(db, ctx, "rentals", true) ? (
                  <Button
                    onClick={() => {
                      go({ view: "rentals", tab: "quotation", id: "" });
                    }}
                  >
                    Create a quotation
                  </Button>
                ) : null}
                {view === "dashboard" &&
                allowed(db, ctx, "administration", true) ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        go({ view: "administration", tab: "company", id: "" })
                      }
                    >
                      Manage companies
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        go({ view: "administration", tab: "branch", id: "" })
                      }
                    >
                      Manage branches
                    </Button>
                  </>
                ) : null}
                {creatingAllowed && !id && view !== "dashboard" ? (
                  <Button onClick={create}>Create {entityName(tab!)}</Button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-2 text-label">
                From date
                <InputDate
                  value={range.from}
                  onChange={(value) => go({ from: value, page: "1" })}
                />
              </label>
              <label className="space-y-2 text-label">
                To date
                <InputDate
                  value={range.to}
                  onChange={(value) => go({ to: value, page: "1" })}
                />
              </label>
              {range.from || range.to ? (
                <Button
                  variant="ghost"
                  onClick={() => go({ from: "", to: "", page: "1" })}
                >
                  Clear dates
                </Button>
              ) : null}
            </div>
            <ModuleMetrics db={db} ctx={ctx} view={view} range={range} />
            {view === "dashboard" || view === "operations" ? (
              <Overview
                db={db}
                ctx={ctx}
                range={range}
                onOpen={open}
                operational={view === "operations"}
              />
            ) : null}
            {view === "reports" ? (
              <Reports
                db={db}
                ctx={ctx}
                range={range}
                selected={params.get("report") ?? "revenue"}
                onSelect={(report) => go({ report })}
              />
            ) : (
              <>
                {available.length > 1 ? (
                  <div
                    aria-label="Module sections"
                    className="flex flex-wrap gap-2"
                  >
                    {available
                      .filter((k) => allowed(db, ctx, kindModule[k]))
                      .map((kind) => (
                        <Button
                          key={kind}
                          variant={tab === kind ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            go({
                              tab: kind,
                              id: "",
                              q: "",
                              filter: "",
                              page: "1",
                            })
                          }
                        >
                          {screens[kind].label}
                        </Button>
                      ))}
                    {view === "finance" ? (
                      <Button
                        size="sm"
                        variant={
                          params.get("ledger") === "1" ? "default" : "outline"
                        }
                        onClick={() =>
                          go({
                            ledger: params.get("ledger") === "1" ? "" : "1",
                            id: "",
                          })
                        }
                      >
                        Accounting ledger
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {view === "finance" && params.get("ledger") === "1" ? (
                  <Reports
                    db={db}
                    ctx={ctx}
                    range={range}
                    selected="revenue"
                    onSelect={() => {}}
                    ledgerOnly
                  />
                ) : id ? (
                  validRecord ? (
                    <div className="space-y-5">
                      <Button variant="ghost" onClick={() => go({ id: "" })}>
                        Back to {screen?.label.toLowerCase()}
                      </Button>
                      <Detail
                        db={db}
                        ctx={ctx}
                        entity={record!}
                        onOpen={open}
                        onEdit={() =>
                          setModal({
                            title: `Edit ${label(record!)}`,
                            description:
                              "Company and branch ownership stay fixed. Changes are saved only in this demo.",
                            record: record!,
                            kind: record!.kind,
                            token,
                          })
                        }
                        onAction={(workflow) =>
                          setModal({
                            title: workflow.label,
                            description: workflow.description,
                            record: record!,
                            workflow,
                            token,
                          })
                        }
                        onDelete={() =>
                          setModal({
                            title: "Delete this unlinked record?",
                            description:
                              "Deletion is refused when another business record refers to it. Audit history is retained.",
                            record: record!,
                            remove: true,
                            token,
                          })
                        }
                      />
                    </div>
                  ) : (
                    <StatePanel title="Demo record unavailable">
                      This record is missing, outside the selected context, or
                      inaccessible to the selected role.
                    </StatePanel>
                  )
                ) : tab && allowed(db, ctx, kindModule[tab]) ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {screen?.description}
                    </p>
                    <RecordTable
                      db={db}
                      ctx={ctx}
                      kind={tab}
                      range={range}
                      state={{
                        q: params.get("q") ?? "",
                        filter: params.get("filter") ?? "",
                        sort: params.get("sort") ?? `${screen?.columns[0]}:asc`,
                        page: Math.max(1, Number(params.get("page")) || 1),
                      }}
                      onState={(next) =>
                        go(
                          Object.fromEntries(
                            Object.entries(next).map(([key, value]) => [
                              key,
                              String(value),
                            ]),
                          ),
                        )
                      }
                      onView={(id) => go({ id })}
                    />
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
        <footer className="border-t pt-4 text-label text-muted-foreground">
          Prototype rules run locally. No Laravel calls, real documents, live
          balances or certified tax/accounting calculations.
        </footer>
      </main>
      {resetDialog}
      <Dialog
        open={!!modal && modal.token === token}
        onOpenChange={(open) => {
          if (!open && !formBusy) setModal(null);
        }}
      >
        <DialogContent
          showCloseButton={!formBusy}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-card p-card sm:max-w-2xl motion-reduce:duration-0 motion-reduce:animate-none motion-reduce:transition-none"
        >
          <DialogHeader className="pr-6">
            <DialogTitle>{modal?.title ?? "Demo change"}</DialogTitle>
            <DialogDescription>{modal?.description}</DialogDescription>
          </DialogHeader>
          {modal && modal.token === token ? (
            <DemoForm
              key={modal.title + modal.record?.id + token}
              db={db}
              ctx={ctx}
              fields={
                modal.workflow?.fields ??
                (modal.remove
                  ? []
                  : modal.kind
                    ? (screens[modal.kind].fields ?? [])
                    : [])
              }
              record={modal.record}
              branchRequired={
                !!modal.kind &&
                !["company", "branch", "role", "user", "setting"].includes(
                  modal.kind,
                )
              }
              onBusy={setFormBusy}
              onSave={async (values) => {
                const start = token,
                  startURL = window.location.href;
                let command: Command;
                if (modal.remove)
                  command = { type: "delete", id: modal.record!.id };
                else if (modal.workflow)
                  command = {
                    type: "action",
                    id: modal.record!.id,
                    action: modal.workflow.action,
                    values,
                  };
                else
                  command = {
                    type: "save",
                    kind: modal.kind!,
                    id: modal.record?.id,
                    values,
                  };
                const updated = await execute(ctx, command);
                if (
                  currentToken.current !== start ||
                  window.location.href !== startURL
                )
                  return;
                setModal(null);
                if (command.type === "delete") go({ id: "" });
                else if (command.type === "save") {
                  const saved = command.id
                    ? updated.entities.find((e) => e.id === command.id)
                    : updated.entities.find(
                        (e) =>
                          e.kind === command.kind &&
                          !db.entities.some((old) => old.id === e.id),
                      );
                  if (saved) {
                    if (saved.kind === "company")
                      go({
                        company: saved.id,
                        branch: "all",
                        view: "administration",
                        tab: "branch",
                        id: "",
                      });
                    else if (saved.kind === "branch")
                      go({
                        branch: saved.id,
                        view: "administration",
                        tab: "branch",
                        id: saved.id,
                      });
                    else open(saved);
                  }
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </PrototypeShell>
  );
}
function InputDate({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="date"
      className={selectClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
export function ErpDemo() {
  return (
    <DemoProvider>
      <Workspace />
    </DemoProvider>
  );
}
