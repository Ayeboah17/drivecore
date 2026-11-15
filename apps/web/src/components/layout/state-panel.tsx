import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export function StatePanel({
  title,
  children,
  onRetry,
  href,
  linkLabel = "Return to workspace",
}: {
  title: string;
  children: React.ReactNode;
  onRetry?: () => void;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <section
      className="dc-shadow-card rounded-2xl border bg-surface p-card"
      aria-label={title}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground"
        >
          <AlertCircle className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-2">
          <h2 className="text-card-heading">{title}</h2>
          <div className="text-sm text-muted-foreground">{children}</div>
          {onRetry && (
            <Button className="mt-2" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
          {href && (
            <Link
              className="mt-2 inline-flex items-center gap-2 rounded-sm text-link hover:text-link-hover underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              href={href}
            >
              {linkLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
