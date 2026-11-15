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
      className="rounded-card border bg-surface p-card"
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-1 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
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
