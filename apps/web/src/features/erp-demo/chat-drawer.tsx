"use client";

import { useState } from "react";
import { CheckCheck, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DriveCoreSelect } from "@/components/ui/drivecore-select";
import { allowed } from "@/lib/demo/permissions";
import { label, rows } from "@/lib/demo/selectors";
import {
  entities,
  type Database,
  type DemoContext,
  type Entity,
  type Of,
} from "@/lib/demo/types";
import { useDemo } from "./provider";

const CHANNELS = [
  { value: "all", label: "All channels" },
  { value: "dispatch", label: "Dispatch" },
  { value: "drivers", label: "Drivers" },
  { value: "customers", label: "Customers" },
  { value: "support", label: "Support" },
] as const;

export function ChatCenterDrawer({
  db,
  ctx,
  busy,
  onOpenRecord,
}: {
  db: Database;
  ctx: DemoContext;
  busy: boolean;
  onOpenRecord?: (entity: Entity) => void;
}) {
  const { execute } = useDemo();
  const [open, setOpen] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [composerChannel, setComposerChannel] = useState<string>("dispatch");
  const [relatedId, setRelatedId] = useState<string>("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  let messages: Of<"message">[] = [];
  let relatedOptions: Entity[] = [];
  try {
    messages = rows(db, ctx, "message").sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    relatedOptions = [
      ...rows(db, ctx, "vehicle"),
      ...rows(db, ctx, "quotation"),
      ...rows(db, ctx, "rental"),
    ].slice(0, 24);
  } catch {
    messages = [];
  }

  const unreadCount = messages.filter(
    (m) => !m.readBy.includes(ctx.userId),
  ).length;
  const visible =
    channelFilter === "all"
      ? messages
      : messages.filter((m) => m.channel === channelFilter);
  const canSend = allowed(db, ctx, "dashboard", true);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError("Enter a message before sending.");
      return;
    }
    setError("");
    try {
      await execute(ctx, {
        type: "save",
        kind: "message",
        values: {
          channel: composerChannel,
          body: body.trim(),
          relatedEntityId: relatedId,
        },
      });
      setBody("");
      setRelatedId("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not send message.",
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size="icon"
            variant="outline"
            className="relative size-9 rounded-xl"
            aria-label={`Messaging & Chat Center (${unreadCount} unread)`}
          />
        }
      >
        <MessageSquare className="size-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-structural font-mono text-[10px] font-bold text-structural-foreground">
            {unreadCount}
          </span>
        ) : null}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <div className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-link" aria-hidden="true" />
            Messaging & Chat Center
          </SheetTitle>
          <SheetDescription>
            Branch-scoped dispatch, driver, and customer inquiry threads
            (stored in IndexedDB).
          </SheetDescription>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CHANNELS.map((ch) => (
              <button
                key={ch.value}
                type="button"
                onClick={() => setChannelFilter(ch.value)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                  channelFilter === ch.value
                    ? "bg-structural text-structural-foreground"
                    : "border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
              No messages in this channel for the current branch scope.
            </p>
          ) : (
            visible.map((msg) => {
              const unread = !msg.readBy.includes(ctx.userId);
              const linked = msg.relatedEntityId
                ? entities(db, "vehicle").find(
                    (e) => e.id === msg.relatedEntityId,
                  ) ?? db.entities.find((e) => e.id === msg.relatedEntityId)
                : undefined;
              return (
                <article
                  key={msg.id}
                  className={`space-y-2 rounded-2xl border p-3.5 text-sm ${
                    unread ? "border-primary/40 bg-accent/25" : "bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold">
                        {msg.senderName}
                      </span>
                      <span className="rounded-md bg-structural px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-structural-foreground">
                        {msg.channel}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="leading-relaxed text-foreground">{msg.body}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {linked && onOpenRecord ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg text-xs"
                        onClick={() => {
                          onOpenRecord(linked);
                          setOpen(false);
                        }}
                      >
                        Open {label(linked)}
                      </Button>
                    ) : null}
                    {unread ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        className="h-7 rounded-lg text-xs"
                        onClick={() => {
                          void execute(ctx, {
                            type: "action",
                            id: msg.id,
                            action: "read",
                            values: {},
                          });
                        }}
                      >
                        <CheckCheck
                          className="mr-1 size-3.5"
                          aria-hidden="true"
                        />
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>

        <form onSubmit={handleSend} className="space-y-2.5 border-t bg-muted/25 p-4">
          {!canSend ? (
            <p className="text-xs text-muted-foreground">
              This role has read-only messaging access. Switch roles to post
              updates.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <DriveCoreSelect
                  ariaLabel="Message channel"
                  value={composerChannel}
                  onValueChange={setComposerChannel}
                  options={CHANNELS.filter((c) => c.value !== "all")}
                />
                <DriveCoreSelect
                  ariaLabel="Link record (optional)"
                  value={relatedId}
                  onValueChange={setRelatedId}
                  placeholder="Link record"
                  options={[
                    { value: "", label: "No linked record" },
                    ...relatedOptions.map((item) => ({
                      value: item.id,
                      label: `${item.kind}: ${label(item)}`,
                    })),
                  ]}
                />
              </div>
              <Textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setError("");
                }}
                placeholder="Send a branch dispatch, driver handoff, or customer message…"
                rows={2}
                maxLength={1000}
                className="rounded-xl bg-surface text-sm"
              />
              {error ? (
                <p role="alert" className="text-xs text-danger-foreground">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                size="sm"
                disabled={busy}
                className="w-full gap-1.5 rounded-xl"
              >
                <Send className="size-3.5" aria-hidden="true" />
                Send message
              </Button>
            </>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
