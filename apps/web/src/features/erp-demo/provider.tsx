"use client";
import { useEffect, useRef, useState, createContext, useContext } from "react";
import {
  QueryClientProvider,
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createQueryClient } from "@/lib/data/query-client";
import {
  browserDemoRepository,
  type DemoRepository,
} from "@/lib/demo/repository";
import type { Database, DemoContext, Command } from "@/lib/demo/types";
interface DemoData {
  db: Database;
  repository: DemoRepository;
  execute: (ctx: DemoContext, cmd: Command) => Promise<Database>;
  reset: () => Promise<void>;
  busy: boolean;
  now: number;
  notice: string;
  clearNotice: () => void;
}
const Context = createContext<DemoData | null>(null);
function Data({
  children,
  repository,
}: {
  children: React.ReactNode;
  repository: DemoRepository;
}) {
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const lock = useRef(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false),
    [recovering, setRecovering] = useState(false),
    [recoveryError, setRecoveryError] = useState("");
  const query = useQuery({
    queryKey: ["erp-demo", "snapshot"],
    networkMode: "always",
    queryFn: ({ signal }) => repository.load(signal),
    staleTime: Infinity,
    retry: false,
  });
  useEffect(
    () =>
      repository.subscribe(() => {
        void client.invalidateQueries({ queryKey: ["erp-demo"] });
      }),
    [repository, client],
  );
  const mutation = useMutation({
    networkMode: "always",
    onMutate: () => setNotice(""),
    mutationFn: ({ ctx, cmd }: { ctx: DemoContext; cmd: Command }) =>
      repository.execute(ctx, cmd),
    onSuccess: async (db) => {
      await client.cancelQueries({ queryKey: ["erp-demo"] });
      client.setQueryData(["erp-demo", "snapshot"], db);
      setNotice("Saved in the demo. Related records are up to date.");
      await client.invalidateQueries({ queryKey: ["erp-demo"] });
    },
    retry: false,
  });
  async function reset() {
    if (lock.current) return;
    lock.current = true;
    try {
      const db = await repository.reset();
      await client.cancelQueries({ queryKey: ["erp-demo"] });
      client.setQueryData(["erp-demo", "snapshot"], db);
      setNotice("Demo restored to its original seeded state.");
    } finally {
      lock.current = false;
    }
  }
  if (query.isPending)
    return (
      <main className="mx-auto max-w-xl space-y-4 p-page py-16">
        <p className="text-xl font-semibold">
          <span className="text-primary">D</span>riveCore
        </p>
        <p role="status">Opening the demo repository…</p>
      </main>
    );
  if (query.error || !query.data)
    return (
      <main className="mx-auto max-w-xl space-y-5 p-page py-16">
        <h1 className="text-page-title">Demo storage unavailable</h1>
        <p role="alert">
          The demo repository could not be read. Browser storage may be blocked,
          full or incompatible with this version.
        </p>
        <p className="text-sm text-muted-foreground">
          Enable browser storage and reload. Existing data is not silently
          replaced. Live records are unaffected.
        </p>
        <button
          className="rounded-control border px-4 py-2"
          onClick={() => void query.refetch()}
        >
          Retry storage
        </button>
        <Dialog
          open={recoveryOpen}
          onOpenChange={(open) => {
            if (!recovering) setRecoveryOpen(open);
          }}
        >
          <Button variant="outline" onClick={() => setRecoveryOpen(true)}>
            Reset incompatible demo data
          </Button>
          <DialogContent
            showCloseButton={!recovering}
            className="motion-reduce:animate-none motion-reduce:transition-none"
          >
            <DialogHeader>
              <DialogTitle>Restore demo storage?</DialogTitle>
              <DialogDescription>
                This replaces only the full ERP demo database with fresh
                synthetic records. All unsaved demo changes are lost. Live
                records are untouched.
              </DialogDescription>
            </DialogHeader>
            {recoveryError ? <p role="alert">{recoveryError}</p> : null}
            <Button
              disabled={recovering}
              onClick={async () => {
                setRecovering(true);
                try {
                  await reset();
                  setRecoveryOpen(false);
                } catch {
                  setRecoveryError(
                    "Storage could not be reset. Enable IndexedDB and retry; no data was silently replaced.",
                  );
                } finally {
                  setRecovering(false);
                }
              }}
            >
              {recovering ? "Restoring…" : "Restore demo data"}
            </Button>
          </DialogContent>
        </Dialog>
      </main>
    );
  return (
    <Context
      value={{
        db: query.data,
        repository,
        execute: (ctx, cmd) => mutation.mutateAsync({ ctx, cmd }),
        reset,
        busy: mutation.isPending,
        now,
        notice,
        clearNotice: () => setNotice(""),
      }}
    >
      {children}
    </Context>
  );
}
export function DemoProvider({
  children,
  repository = browserDemoRepository,
}: {
  children: React.ReactNode;
  repository?: DemoRepository;
}) {
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <Data repository={repository}>{children}</Data>
    </QueryClientProvider>
  );
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("Demo provider missing");
  return value;
}
