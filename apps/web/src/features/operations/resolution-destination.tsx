"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useResolvedContext } from "@/lib/context/context-provider";
import { useDevelopment } from "@/mocks/development-provider";
import { findModule } from "@/lib/navigation/definitions";
import { modulePath } from "@/lib/navigation/routes";
export function ResolutionDestination({
  destination,
}: {
  destination: { moduleKey: string; label: string };
}) {
  const context = useResolvedContext();
  const { profile } = useDevelopment();
  const item = findModule(destination.moduleKey);
  return (
    <div className="mt-3 border-t pt-3 text-sm">
      <p className="text-label text-muted-foreground">
        Intended resolution destination
      </p>
      <p className="mt-1">{destination.label}</p>
      {item && profile.modules.includes(item.key) ? (
        <Link
          className="mt-1 inline-flex items-center gap-1 rounded-sm text-link hover:text-link-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          href={modulePath(context, item.key)}
        >
          {item.label} · Planned
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </Link>
      ) : (
        <p className="mt-1 text-label text-muted-foreground">
          Destination not accessible to this simulated profile
        </p>
      )}
      <p className="mt-2 text-label text-muted-foreground">
        Resolution actions are outside Milestone 2. No status can be changed
        here.
      </p>
    </div>
  );
}
