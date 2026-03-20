import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AlertCircle, Camera, PlayCircle } from 'lucide-react';
import { BodyWorkspace } from '@/components/features/body-workspace';

export const dynamic = 'force-dynamic';

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

  const completedWorkouts = (workoutLogs ?? []).filter((w) => w.completed).length;
  const activeStreak = (streaks ?? []).find((s) => s.streak_type === 'workout');

  const caloriesTarget = Math.max(1200, Math.round(Number(physical?.tdee ?? 2200)));
  const caloriesValue = Math.max(0, Math.round(macroTotals.calories));
  const caloriesRemaining = Math.max(0, caloriesTarget - caloriesValue);
  const proteinTarget = 160;
  const carbsTarget = 240;

  const macroRings = [
    { value: caloriesValue, max: caloriesTarget, color: '#FF6B35', radius: 80, width: 12 },
    { value: macroTotals.protein, max: proteinTarget, color: '#FF9A5C', radius: 60, width: 12 },
    { value: macroTotals.carbs, max: carbsTarget, color: '#FFC3A0', radius: 40, width: 12 },
  ];

  return (
    <main className="min-h-full px-6 pb-24 pt-8 text-white lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Body</p>
            <h1 className="mt-1 text-3xl font-semibold">Physical</h1>
          </div>
          <p className="text-xs text-white/45">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>

        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Track Snapshot</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Link href="/dashboard/body" className="rounded-[12px] border border-[#FF6B35]/25 bg-[#FF6B35]/8 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#FFC3A0]">Physical</p>
              <p className="mt-1 font-semibold">{recentMeals?.length ?? 0} meals</p>
              <p className="text-xs text-white/55">{physical?.goal ?? 'Goal not set'}</p>
            </Link>
            <Link href="/dashboard/mind" className="rounded-[12px] border border-[#A78BFA]/25 bg-[#A78BFA]/8 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#D5C7FF]">Mental</p>
              <p className="mt-1 font-semibold">Open mindset hub</p>
              <p className="text-xs text-white/55">Tasks, rituals, focus</p>
            </Link>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#FF6B35]/30 bg-gradient-to-b from-[#FF6B35]/18 to-transparent p-5 backdrop-blur-[14px]">
          <div className="relative mx-auto h-[200px] w-[200px]">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 200 200">
              {macroRings.map((ring) => {
                const circumference = 2 * Math.PI * ring.radius;
                const pct = Math.max(0, Math.min(ring.value / ring.max, 1));
                return (
                  <g key={`${ring.radius}-${ring.color}`}>
                    <circle cx="100" cy="100" r={ring.radius} stroke="rgba(255,255,255,0.08)" strokeWidth={ring.width} fill="transparent" />
                    <circle
                      cx="100"
                      cy="100"
                      r={ring.radius}
                      stroke={ring.color}
                      strokeWidth={ring.width}
                      fill="transparent"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - pct * circumference}
                    />
                  </g>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold tracking-tight">{caloriesRemaining}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/45">kcal left</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-[#FF9A5C]">{Math.round(macroTotals.protein)}g</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Protein</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[#FFC3A0]">{Math.round(macroTotals.carbs)}g</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Carbs</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white/80">{Math.round(macroTotals.fat)}g</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Fat</p>
            </div>
          </div>
        </div>

        <Link
          href="/dashboard/body?openCamera=1#meal-logging"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-[#FF6B35] to-[#FF9A5C] text-sm font-semibold text-white shadow-[0_0_20px_rgba(255,107,53,0.35)] md:hidden"
        >
          <Camera size={18} />
          Log Meal via Camera
        </Link>

        <div className="flex items-center gap-3 rounded-[12px] border border-[#FF6B35]/30 bg-[#FF6B35]/12 p-4">
          <AlertCircle size={18} className="text-[#FF6B35]" />
          <div>
            <p className="text-sm font-semibold text-white">
              {(recentMealCount ?? 0) >= 5 ? 'Vitamin insights ready' : 'Vitamin analysis pending'}
            </p>
            <p className="text-xs text-white/60">
              {(recentMealCount ?? 0) >= 5
                ? `Last updated ${latestVitamin?.generated_at ? new Date(latestVitamin.generated_at).toLocaleDateString() : 'today'}`
                : `Log ${5 - (recentMealCount ?? 0)} more meals for 5-day rolling insights`}
            </p>
          </div>
        </div>

        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-[14px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Workout of the Day</p>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white/80">45 MIN</span>
          </div>
          <h3 className="mt-3 text-xl font-bold">
            {physical?.goal ? `${String(physical.goal).replace('_', ' ')} Session` : 'Hypertrophy Push'}
          </h3>
          <p className="text-sm text-white/60">
            {todayBrief?.greeting || `${completedWorkouts} completed workouts this week. Keep momentum.`}
          </p>
          <div className="mt-4">
            <Link href="/dashboard/body?startWorkout=1#workout-planner" className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-white text-sm font-bold text-black">
              <PlayCircle size={16} />
              Start
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Streak</p>
            <p className="mt-2 text-2xl font-bold">{activeStreak?.current_count ?? profile?.streak_count ?? 0}</p>
            <p className="text-xs text-white/55">Longest {activeStreak?.longest_count ?? 0}</p>
          </div>
          <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">TDEE</p>
            <p className="mt-2 text-2xl font-bold">{Math.round(Number(physical?.tdee ?? 0)) || '--'}</p>
            <p className="text-xs text-white/55">cal/day</p>
          </div>
        </div>

        <BodyWorkspace />
      </div>
    </main>
  );
}
