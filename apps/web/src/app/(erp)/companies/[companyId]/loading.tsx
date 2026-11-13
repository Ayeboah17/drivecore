import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-4 p-page">
      <Skeleton className="h-8 w-60" />
      <Skeleton className="h-60 w-full" />
    </div>
  );
}
