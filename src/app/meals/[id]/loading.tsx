import { SkeletonCard } from '@/components/app/skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen bg-bg-primary px-6 py-10 text-accent-white sm:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <div className="h-3 w-16 animate-pulse rounded bg-bg-surface" />
          <div className="mt-4 h-10 w-40 animate-pulse rounded bg-bg-surface" />
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-bg-surface/40" />
        <div className="grid gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </main>
  );
}
