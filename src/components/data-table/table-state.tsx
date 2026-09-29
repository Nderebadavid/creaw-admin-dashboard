import { Button } from "@/components/ui/button";

export function TableState({
  loading,
  error,
  filtered,
  onRetry,
}: {
  loading?: boolean;
  error?: string;
  filtered?: boolean;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <div role="status" aria-live="polite" className="space-y-4 p-8">
        <span className="sr-only">Loading records</span>
        {[1, 2, 3, 4].map((row) => (
          <div key={row} aria-hidden="true" className="h-9 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  if (error)
    return (
      <div role="alert" className="space-y-3 p-10 text-center">
        <p>{error}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  return (
    <div role="status" className="p-12 text-center">
      <h3 className="font-heading text-xl font-semibold">
        {filtered ? "No matching records" : "No records yet"}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {filtered
          ? "Try changing or clearing your filters."
          : "Records will appear here when they are added."}
      </p>
    </div>
  );
}
