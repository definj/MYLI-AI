import { FeatureShell } from '@/components/app/feature-shell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('workout_logs').select('*').eq('id', id).single();

  return (
    <FeatureShell
      eyebrow="Workouts"
      title="Workout Session"
      description="Review and log exercise completion, duration, and notes for this session."
    >
      <pre className="overflow-auto rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-xs text-accent-muted">
        {JSON.stringify(data ?? { id, message: 'No workout log found.' }, null, 2)}
      </pre>
    </FeatureShell>
  );
}
