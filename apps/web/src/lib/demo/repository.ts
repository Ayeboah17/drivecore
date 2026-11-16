import { createSeed } from "./seed";
import { applyCommand } from "./rules";
import {
  databaseSchema,
  DemoError,
  type Database,
  type DemoContext,
  type Command,
} from "./types";
export interface DemoRepository {
  load(signal?: AbortSignal): Promise<Database>;
  execute(
    context: DemoContext,
    command: Command,
    signal?: AbortSignal,
  ): Promise<Database>;
  reset(signal?: AbortSignal): Promise<Database>;
  subscribe(listener: () => void): () => void;
}
export const databaseName = "drivecore-erp-demo-v1";
const changeEvent = "drivecore-erp-demo-change";
export function pause(signal?: AbortSignal, ms = 180) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
class BrowserDemoRepository implements DemoRepository {
  private opened: Promise<IDBDatabase> | null = null;
  private db(): Promise<IDBDatabase> {
    if (!this.opened)
      this.opened = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
          reject(
            new DemoError(
              "Demo storage is unavailable. Enable IndexedDB in this browser.",
            ),
          );
          return;
        }
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("snapshots");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(
            new DemoError(
              "Could not open demo storage. No live data was accessed.",
            ),
          );
        request.onblocked = () =>
          reject(
            new DemoError("Close other demo tabs and retry opening storage."),
          );
      }).catch((e) => {
        this.opened = null;
        throw e;
      });
    return this.opened;
  }
  private async transaction(
    change?: (db: Database) => Database,
    replace = false,
  ) {
    const db = await this.db();
    return new Promise<Database>((resolve, reject) => {
      const tx = db.transaction("snapshots", "readwrite"),
        store = tx.objectStore("snapshots"),
        read = store.get("main");
      let next: Database;
      let failure: unknown;
      read.onsuccess = () => {
        try {
          const existing =
            read.result === undefined || replace
              ? createSeed()
              : databaseSchema.parse(read.result);
          next = change ? change(existing) : existing;
          if (change || read.result === undefined)
            store.put(databaseSchema.parse(next), "main");
        } catch (e) {
          failure = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = tx.onabort = () =>
        reject(
          failure instanceof Error
            ? failure
            : new DemoError(
                "Demo data could not be saved. Check browser storage; changes were not applied.",
              ),
        );
    });
  }
  async load(signal?: AbortSignal) {
    await pause(signal);
    return this.transaction();
  }
  async execute(ctx: DemoContext, command: Command, signal?: AbortSignal) {
    await pause(signal);
    const result = await this.transaction((db) =>
      applyCommand(db, ctx, command),
    );
    this.announce();
    return result;
  }
  async reset(signal?: AbortSignal) {
    await pause(signal);
    const result = await this.transaction(() => createSeed(), true);
    this.announce();
    return result;
  }
  private announce() {
    window.dispatchEvent(new Event(changeEvent));
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(changeEvent);
      channel.postMessage("changed");
      channel.close();
    }
  }
  subscribe(listener: () => void) {
    window.addEventListener(changeEvent, listener);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(changeEvent)
        : null;
    if (channel) channel.onmessage = listener;
    return () => {
      window.removeEventListener(changeEvent, listener);
      channel?.close();
    };
  }
}
export const browserDemoRepository: DemoRepository =
  new BrowserDemoRepository();
// Deterministic test adapter. Never an automatic browser-storage fallback.
export class MemoryDemoRepository implements DemoRepository {
  constructor(
    private data: Database = createSeed(),
    private delay = 0,
  ) {}
  async load(signal?: AbortSignal) {
    await pause(signal, this.delay);
    return structuredClone(this.data);
  }
  async execute(ctx: DemoContext, command: Command, signal?: AbortSignal) {
    await pause(signal, this.delay);
    this.data = applyCommand(this.data, ctx, command);
    return structuredClone(this.data);
  }
  async reset() {
    this.data = createSeed();
    return structuredClone(this.data);
  }
  subscribe() {
    return () => {};
  }
}
