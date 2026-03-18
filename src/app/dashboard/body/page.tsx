import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function MacroBar({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / target) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-accent-muted">{label}</span>
        <span className="font-mono text-xs text-accent-white">
          {Math.round(value)} / {target}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-bg-secondary">
        <div
          className="h-full bg-accent-gold transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function BodyDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/onboarding');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const todayDate = new Date().toISOString().split('T')[0];

  const [{ data: profile }, { data: physical }, { data: recentMeals }, { data: streaks }, { data: workoutLogs }, { count: recentMealCount }, { data: latestVitamin }, { data: todayBrief }] =
    await Promise.all([
      supabase.from('profiles').select('myli_score, streak_count, track').eq('user_id', user.id).single(),
      supabase
        .from('physical_profiles')
        .select('goal, bmi, bmr, tdee, activity_level, weight_kg')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('meal_logs')
        .select('calories, protein_g, carbs_g, fat_g, logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', todayStart.toISOString()),
      supabase
        .from('streaks')
        .select('streak_type, current_count, longest_count')
        .eq('user_id', user.id),
      supabase
        .from('workout_logs')
        .select('date, completed, duration_min')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(7),
      supabase
        .from('meal_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('logged_at', fiveDaysAgo.toISOString()),
      supabase
        .from('vitamin_analysis')
        .select('generated_at')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('daily_briefs')
        .select('greeting, motivation')
        .eq('user_id', user.id)
        .eq('brief_date', todayDate)
        .maybeSingle(),
    ]);

  const macroTotals = (recentMeals ?? []).reduce(
    (acc, meal) => {
      acc.calories += Number(meal.calories ?? 0);
      acc.protein += Number(meal.protein_g ?? 0);
      acc.carbs += Number(meal.carbs_g ?? 0);
      acc.fat += Number(meal.fat_g ?? 0);
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const targets = {
    calories: Math.max(1200, Math.round(Number(physical?.tdee ?? 2200))),
    protein: 160,
    carbs: 240,
    fat: 70,
  };

  const completedWorkouts = (workoutLogs ?? []).filter((w) => w.completed).length;
  const activeStreak = (streaks ?? []).find((s) => s.streak_type === 'workout') ?? null;

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-8 text-accent-white sm:px-10 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-muted">Dashboard / Body</p>
          <h1 className="mt-3 font-display text-4xl">Physical Track Dashboard</h1>
          <p className="mt-2 text-accent-muted">
            Today at a glance: fuel targets, workout consistency, and physical profile health metrics.
          </p>
        </div>

        {todayBrief ? (
          <Link href="/brief" className="block rounded-xl border border-accent-gold/20 bg-bg-surface/70 p-4 transition-colors hover:border-accent-gold/40">
            <p className="text-sm text-accent-white">{todayBrief.greeting}</p>
            <p className="mt-1 text-xs italic text-accent-gold">&ldquo;{todayBrief.motivation}&rdquo;</p>
          </Link>
        ) : (
          <Link href="/brief" className="block rounded-xl border border-bg-surface bg-bg-surface/40 p-4 transition-colors hover:border-accent-gold/30">
            <p className="text-sm text-accent-muted">Your daily brief is ready. Tap to generate today's personalized summary.</p>
          </Link>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">MYLI Score</p>
            <p className="mt-2 font-display text-4xl text-accent-gold">{profile?.myli_score ?? 0}</p>
            <p className="mt-2 text-sm text-accent-muted">Composite momentum score updates with daily consistency.</p>
          </div>

          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Workout Streak</p>
            <p className="mt-2 font-display text-4xl">{activeStreak?.current_count ?? profile?.streak_count ?? 0}</p>
            <p className="mt-2 text-sm text-accent-muted">
              Longest: {activeStreak?.longest_count ?? 0} days
            </p>
          </div>

          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Workouts (7d)</p>
            <p className="mt-2 font-display text-4xl">{completedWorkouts}</p>
            <p className="mt-2 text-sm text-accent-muted">Completed sessions in the last week.</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-sm font-medium text-accent-white">Today Macro Targets</p>
            <div className="mt-4 space-y-4">
              <MacroBar label="Calories" value={macroTotals.calories} target={targets.calories} />
              <MacroBar label="Protein (g)" value={macroTotals.protein} target={targets.protein} />
              <MacroBar label="Carbs (g)" value={macroTotals.carbs} target={targets.carbs} />
              <MacroBar label="Fat (g)" value={macroTotals.fat} target={targets.fat} />
            </div>
            <Link
              href="/meals"
              className="mt-5 inline-flex rounded-md bg-accent-gold px-4 py-2 text-sm font-medium text-bg-primary hover:bg-accent-gold/90"
            >
              Log Meal
            </Link>
          </div>

          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-sm font-medium text-accent-white">Physical Profile Snapshot</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-bg-secondary p-3">
                <p className="text-accent-muted">Goal</p>
                <p className="mt-1">{physical?.goal ?? 'Not set'}</p>
              </div>
              <div className="rounded-md bg-bg-secondary p-3">
                <p className="text-accent-muted">Activity</p>
                <p className="mt-1">{physical?.activity_level ?? 'Not set'}</p>
              </div>
              <div className="rounded-md bg-bg-secondary p-3">
                <p className="text-accent-muted">BMI</p>
                <p className="mt-1 font-display text-lg text-accent-gold">{physical?.bmi ?? '--'}</p>
              </div>
              <div className="rounded-md bg-bg-secondary p-3">
                <p className="text-accent-muted">BMR</p>
                <p className="mt-1 font-display text-lg text-accent-gold">{physical?.bmr ?? '--'}</p>
              </div>
              <div className="col-span-2 rounded-md bg-bg-secondary p-3">
                <p className="text-accent-muted">TDEE (Daily Calories)</p>
                <p className="mt-1 font-display text-lg text-accent-gold">{physical?.tdee ?? '--'}</p>
              </div>
            </div>
            <Link
              href="/workouts"
              className="mt-5 inline-flex rounded-md border border-bg-surface bg-bg-secondary px-4 py-2 text-sm text-accent-white hover:bg-bg-primary"
            >
              View Workout Plans
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-accent-white">Vitamin & Nutrient Insights</p>
              <p className="mt-1 text-sm text-accent-muted">
                {(recentMealCount ?? 0) >= 5
                  ? 'You have enough recent meals for a vitamin analysis.'
                  : `Log ${5 - (recentMealCount ?? 0)} more meals in the next 5 days to unlock vitamin insights.`}
              </p>
              {latestVitamin?.generated_at && (
                <p className="mt-1 text-xs text-accent-muted">
                  Last report: {new Date(latestVitamin.generated_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <Link
              href="/insights/vitamins"
              className={`inline-flex rounded-md px-4 py-2 text-sm font-medium ${
                (recentMealCount ?? 0) >= 5
                  ? 'bg-accent-gold text-bg-primary hover:bg-accent-gold/90'
                  : 'bg-bg-secondary text-accent-muted'
              }`}
            >
              View Insights
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
