import { SkeletonCard, SkeletonRow } from '@/components/app/skeleton';

export default function Loading() {
  return (
    <main className="min-h-screen bg-bg-primary px-6 py-10 text-accent-white sm:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <div className="h-3 w-20 animate-pulse rounded bg-bg-surface" />
          <div className="mt-4 h-10 w-48 animate-pulse rounded bg-bg-surface" />
          <div className="mt-3 h-4 w-72 animate-pulse rounded bg-bg-surface" />
        </div>
        <SkeletonCard className="h-14" />
        <div className="space-y-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    </main>
  );
}
