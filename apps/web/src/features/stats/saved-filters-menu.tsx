"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Globe, Lock, Plus, Trash2 } from "lucide-react";
import { useSession } from "@/features/auth/session-provider";
import { useLiveContext } from "@/features/live/context";
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
} from "@/features/stats/service";
import { errorText } from "@/lib/api/client";
import {
  canAccessUserAdmin,
  type SavedFilter,
  type SavedFilterModule,
} from "@/lib/api/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function SavedFiltersMenu({
  module,
  currentFilters,
  onApply,
}: {
  module: SavedFilterModule;
  currentFilters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}) {
  const { user } = useSession();
  const scope = useLiveContext();
  const client = useQueryClient();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canShare = !!user && canAccessUserAdmin(user, scope.companyId);

  const query = useQuery({
    queryKey: [...scope.key, "saved-filters", module],
    queryFn: ({ signal }) => listSavedFilters(scope.companyId, module, signal),
    enabled: !!user && !!scope.companyId,
    retry: false,
  });

  // Hide silently on pre-PR #14 backends
  if (query.data && !query.data.supported) return null;

  const items = query.data?.items ?? [];
  const personal = items.filter((f) => !f.is_shared);
  const shared = items.filter((f) => f.is_shared);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for this saved view.");
      return;
    }
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      await createSavedFilter(
        {
          company_id: Number(scope.companyId),
          module,
          name: trimmed,
          filters: currentFilters,
          is_shared: canShare ? isShared : false,
        },
        ac.signal,
      );
      setName("");
      setIsShared(false);
      await client.invalidateQueries({
        queryKey: [...scope.key, "saved-filters", module],
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: SavedFilter) {
    setBusy(true);
    setError(null);
    const ac = new AbortController();
    try {
      await deleteSavedFilter(item.id, ac.signal);
      await client.invalidateQueries({
        queryKey: [...scope.key, "saved-filters", module],
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function renderRow(item: SavedFilter) {
    const canDelete =
      !!user &&
      ((!item.is_shared && item.user_id === user.id) ||
        (item.is_shared && canShare));
    return (
      <div
        key={item.id}
        className="flex items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2"
      >
        <button
          type="button"
          onClick={() => {
            onApply(item.filters);
            setOpen(false);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold hover:text-link"
        >
          {item.is_shared ? (
            <Globe
              className="size-3.5 shrink-0 text-link"
              aria-hidden="true"
            />
          ) : (
            <Lock
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="truncate">{item.name}</span>
        </button>
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={`Delete saved view ${item.name}`}
            onClick={() => void handleDelete(item)}
            className="size-7 rounded-lg text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="h-control gap-1.5 rounded-xl bg-surface px-3 text-xs font-medium"
      >
        <Bookmark className="size-3.5 text-link" aria-hidden="true" />
        <span>Saved views</span>
        {items.length > 0 ? (
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
            {items.length}
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl p-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="size-4 text-link" aria-hidden="true" />
              Saved filter views
            </DialogTitle>
            <DialogDescription>
              Apply a saved filter combination or save your current filters.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSave(e)} className="space-y-3 border-b pb-4">
            <div className="space-y-1.5">
              <label htmlFor="saved-view-name" className="text-xs font-medium">
                Save current filters as
              </label>
              <div className="flex gap-2">
                <Input
                  id="saved-view-name"
                  maxLength={80}
                  placeholder="e.g. Top Corporate Spenders"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
                <Button type="submit" size="sm" disabled={busy} className="shrink-0 gap-1">
                  <Plus className="size-3.5" aria-hidden="true" />
                  Save view
                </Button>
              </div>
            </div>
            {canShare ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  disabled={busy}
                  className="size-3.5 rounded border"
                />
                Share with company (visible to permitted teammates)
              </label>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </form>

          <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Personal views ({personal.length})
              </p>
              {personal.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No personal saved views yet.
                </p>
              ) : (
                <div className="space-y-1.5">{personal.map(renderRow)}</div>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Company-shared views ({shared.length})
              </p>
              {shared.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No shared views for this module.
                </p>
              ) : (
                <div className="space-y-1.5">{shared.map(renderRow)}</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
