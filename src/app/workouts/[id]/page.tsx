import { FeatureShell } from '@/components/app/feature-shell';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('workout_logs').select('*').eq('id', id).single();

  const exercises = Array.isArray(data?.exercises) ? data.exercises : [];

  return (
    <FeatureShell
      eyebrow="Workouts"
      title="Workout Session"
      description="Review exercise completion, duration, and notes for this session."
    >
      {!data ? (
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6 text-center">
          <p className="text-accent-muted">No workout log found for this session.</p>
          <Link href="/workouts" className="mt-4 inline-flex rounded-md bg-accent-gold px-4 py-2 text-sm font-medium text-bg-primary hover:bg-accent-gold/90">
            Back to Workouts
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4">
              <p className="text-xs uppercase tracking-widest text-accent-muted">Date</p>
              <p className="mt-1 font-display text-xl">{data.date ?? '--'}</p>
            </div>
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4">
              <p className="text-xs uppercase tracking-widest text-accent-muted">Duration</p>
              <p className="mt-1 font-display text-xl">{data.duration_min ?? '--'} min</p>
            </div>
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4">
              <p className="text-xs uppercase tracking-widest text-accent-muted">Status</p>
              <p className={`mt-1 font-display text-xl ${data.completed ? 'text-success' : 'text-warning'}`}>
                {data.completed ? 'Completed' : 'In Progress'}
              </p>
            </div>
          </div>

          {exercises.length > 0 && (
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-3">Exercises</p>
              <div className="space-y-2">
                {exercises.map((ex: Record<string, unknown>, idx: number) => (
                  <div key={idx} className="flex items-center justify-between rounded-md bg-bg-secondary px-3 py-2 text-sm">
                    <span className="text-accent-white">{String(ex.exercise ?? ex.name ?? `Exercise ${idx + 1}`)}</span>
                    <span className="font-mono text-xs text-accent-muted">
                      {ex.sets && ex.reps ? `${ex.sets} x ${ex.reps}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.notes && (
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-2">Notes</p>
              <p className="text-sm text-accent-white">{data.notes}</p>
            </div>
          )}

          <Link href="/workouts" className="inline-flex rounded-md border border-bg-surface bg-bg-secondary px-4 py-2 text-sm text-accent-white hover:bg-bg-primary">
            Back to Workouts
          </Link>
        </div>
      )}
    </FeatureShell>
  );
}
