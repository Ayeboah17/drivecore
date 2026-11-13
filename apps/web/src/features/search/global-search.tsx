"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { useOrganization } from "@/lib/context/context-provider";
import { useGlobalSearch } from "./queries";
import { SearchResults } from "./search-results";
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const { navigate } = useOrganization();
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const params = useSearchParams();
  const result = useGlobalSearch(debounced, open);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 200);
    return () => clearTimeout(timer);
  }, [term]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "k" ||
        event.isComposing ||
        event.altKey
      )
        return;
      const target = event.target as HTMLElement | null;
      if (!open && target?.closest("input, textarea, [contenteditable=true]"))
        return;
      event.preventDefault();
      setOpen(!open);
      if (open) {
        setTerm("");
        setDebounced("");
        requestAnimationFrame(() => trigger.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setTerm("");
      setDebounced("");
      requestAnimationFrame(() => trigger.current?.focus());
    }
  };
  const select = (href: string) => {
    changeOpen(false);
    const url = new URL(href, "https://drivecore.invalid");
    if (
      (url.pathname.includes("/departures/") ||
        url.pathname.includes("/blockers/")) &&
      pathname.endsWith("/dashboard")
    )
      url.searchParams.set("from", pathname + "?" + params.toString());
    navigate(url.pathname + "?" + url.searchParams.toString());
  };
  const waiting = term !== debounced || result.isPending;
  const empty =
    result.data &&
    !result.data.navigation.length &&
    !result.data.departures.length &&
    !result.data.blockers.length;
  return (
    <>
      <Button
        ref={trigger}
        variant="outline"
        aria-label="Global search"
        className="size-control px-0 2xl:w-56 2xl:justify-start 2xl:px-3"
        onClick={() => changeOpen(true)}
      >
        <Search />
        <span className="hidden font-normal text-muted-foreground 2xl:inline">
          Search
        </span>
        <kbd className="ml-auto hidden rounded border px-1 text-[10px] text-muted-foreground 2xl:inline">
          Ctrl / ⌘ K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={changeOpen}
        title="Search DriveCore"
        description="Search permitted destinations and scoped mock departures and blockers"
        className="top-[12%] max-w-[calc(100%-2rem)] translate-y-0 animate-none! duration-0 sm:max-w-xl data-open:animate-none data-closed:animate-none"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search destinations, bookings or blockers"
            value={term}
            onValueChange={setTerm}
            maxLength={100}
            aria-label="Search DriveCore"
          />
          <p className="border-b px-3 py-2 text-xs text-muted-foreground">
            Mock search · Current company and branch scope
          </p>
          <CommandList className="max-h-[60dvh]">
            {waiting ? (
              <p role="status" className="p-4 text-sm text-muted-foreground">
                Searching…
              </p>
            ) : result.isError ? (
              <div className="p-4 text-sm">
                <p>Search unavailable</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => void result.refetch()}
                >
                  Retry search
                </Button>
              </div>
            ) : empty ? (
              <p role="status" className="p-4 text-sm text-muted-foreground">
                {term.trim()
                  ? "No results in this scope"
                  : "No permitted destinations"}
              </p>
            ) : result.data ? (
              <SearchResults results={result.data} onSelect={select} />
            ) : null}
          </CommandList>
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            ↑ ↓ to navigate · Enter to open · Esc to close · Simulated access
            only
          </p>
        </Command>
      </CommandDialog>
    </>
  );
}
