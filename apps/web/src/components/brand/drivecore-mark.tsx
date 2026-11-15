import { cn } from "@/lib/utils";

/** Geometric Key-D brand mark derived from the DriveCore visual language. */
export function DriveCoreMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "sm"
      ? "size-8 rounded-lg"
      : size === "lg"
        ? "size-11 rounded-2xl"
        : "size-9 rounded-xl";
  const svgDims =
    size === "sm" ? "size-5" : size === "lg" ? "size-7" : "size-6";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-primary text-primary-foreground shadow-sm",
        dims,
        className,
      )}
    >
      <svg viewBox="0 0 36 36" className={svgDims} fill="none">
        <path
          d="M8 7H19C25.0751 7 30 11.9249 30 18C30 24.0751 25.0751 29 19 29H8V7Z"
          stroke="currentColor"
          strokeWidth="3.2"
        />
        <circle cx="14" cy="18" r="3.2" fill="currentColor" />
        <path
          d="M17 18H25M22 18V21.5M25 18V21"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** DriveCore brand lockup with Key-D mark, wordmark, and optional environment badge. */
export function DriveCoreLogo({
  badge,
  subtitle,
  collapsed = false,
  className,
}: {
  badge?: string;
  subtitle?: string;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <DriveCoreMark size={collapsed ? "sm" : "md"} />
      {!collapsed ? (
        <span className="min-w-0 leading-tight">
          <span className="flex items-center gap-1.5">
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              <span className="text-link">D</span>riveCore
            </span>
            {badge ? (
              <span className="rounded-md bg-structural px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-structural-foreground">
                {badge}
              </span>
            ) : null}
          </span>
          {subtitle ? (
            <span className="hidden truncate text-[11px] font-medium text-muted-foreground sm:block">
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
