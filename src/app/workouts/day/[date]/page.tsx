import { FeatureShell } from '@/components/app/feature-shell';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { WorkoutDayClient } from '@/components/features/workout-day-client';

export const dynamic = 'force-dynamic';

export default async function WorkoutDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <FeatureShell eyebrow="Workouts" title="Workout Day" description="Sign in to view this workout.">
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6 text-center">
          <p className="text-accent-muted">Unauthorized.</p>
          <Link href="/onboarding" className="mt-4 inline-flex rounded-md bg-accent-gold px-4 py-2 text-sm font-medium text-bg-primary hover:bg-accent-gold/90">
            Sign in
          </Link>
        </div>
      </FeatureShell>
    );
  }

  const { data: active } = await supabase
    .from('workout_plans')
    .select('id, intensity, plan_json, generated_at')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('generated_at', { ascending: false })
    .maybeSingle();

  const weekPlan = (active?.plan_json as any)?.week_plan as
    | { week_start: string; split_name: string; days: Array<{ date: string; title: string; focus: string; exercises: any[] }> }
    | undefined;

  const day = weekPlan?.days?.find((d) => d.date === date) ?? null;

  return (
    <FeatureShell
      eyebrow="Workouts"
      title={`Workout — ${date}`}
      description="View your programmed session and regenerate only this day if needed."
    >
      {!weekPlan || !day ? (
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6 text-center">
          <p className="text-accent-muted">No workout found for this date.</p>
          <Link href="/workouts" className="mt-4 inline-flex rounded-md bg-accent-gold px-4 py-2 text-sm font-medium text-bg-primary hover:bg-accent-gold/90">
            Back to Workouts
          </Link>
        </div>
      ) : (
        <WorkoutDayClient date={date} splitName={weekPlan.split_name} day={day} />
      )}
    </FeatureShell>
  );
}

