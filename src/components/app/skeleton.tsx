export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-bg-surface bg-bg-surface/40 p-5 ${className}`}>
      <div className="h-3 w-24 rounded bg-bg-secondary" />
      <div className="mt-3 h-8 w-32 rounded bg-bg-secondary" />
      <div className="mt-3 h-3 w-48 rounded bg-bg-secondary" />
    </div>
  );
}

export function SkeletonRow() {
  return <div className="h-12 animate-pulse rounded-lg bg-bg-surface/40" />;
}

export function SkeletonPage({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-bg-primary px-6 py-10 text-accent-white sm:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="h-3 w-28 animate-pulse rounded bg-bg-surface" />
          <div className="mt-4 h-10 w-64 animate-pulse rounded bg-bg-surface" />
          <div className="mt-3 h-4 w-96 animate-pulse rounded bg-bg-surface" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
        </div>
      </div>
    </main>
  );
}
