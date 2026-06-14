/** Lightweight placeholder while Product Truth tab chunk or panels load. */
export function ProductTruthTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading Product Truth">
      <div className="card-elevated p-4 space-y-2">
        <div className="h-6 w-40 rounded bg-muted/60" />
        <div className="h-4 w-full max-w-md rounded bg-muted/40" />
        <div className="h-4 w-32 rounded bg-muted/40" />
      </div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-7 w-16 rounded bg-muted/50" />
        ))}
      </div>
      <div className="card-elevated p-4 space-y-3">
        <div className="h-5 w-36 rounded bg-muted/60" />
        <div className="h-2 w-full rounded bg-muted/40" />
        <div className="grid sm:grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded border bg-muted/20" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductTruthPanelSkeleton() {
  return (
    <div className="card-elevated p-4 space-y-3 animate-pulse" aria-busy="true">
      <div className="h-5 w-32 rounded bg-muted/60" />
      <div className="h-2 w-full rounded bg-muted/40" />
      <div className="h-24 rounded bg-muted/20" />
    </div>
  );
}
