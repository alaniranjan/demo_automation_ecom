function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl border border-line bg-surface ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-lg bg-surface-2" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Block className="h-52 lg:col-span-4" />
        <Block className="h-52 lg:col-span-8" />
        <Block className="h-80 lg:col-span-8" />
        <Block className="h-80 lg:col-span-4" />
      </div>
    </div>
  );
}
