import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const todayStart = `${today}T00:00:00.000Z`;
  const todayEnd = `${today}T23:59:59.999Z`;

  const [
    { data: streakRows },
    { data: profile },
    { count: mealsToday },
    { count: workoutsToday },
  ] = await Promise.all([
    supabase
      .from('streaks')
      .select('streak_type, current_count, longest_count, last_date')
      .eq('user_id', user.id),
    supabase.from('profiles').select('myli_score, streak_count').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('meal_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('logged_at', todayStart)
      .lte('logged_at', todayEnd),
    supabase
      .from('workout_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('completed', true),
  ]);

  const byType = new Map((streakRows ?? []).map((r) => [r.streak_type, r]));

  const journalRow = byType.get('journal');
  const taskRow = byType.get('task');

  const challenges = [
    {
      id: 'meal',
      label: 'Fuel',
      detail: 'Log a meal',
      done: (mealsToday ?? 0) > 0,
    },
    {
      id: 'workout',
      label: 'Move',
      detail: 'Train or log a workout',
      done: (workoutsToday ?? 0) > 0,
    },
    {
      id: 'mind',
      label: 'Focus',
      detail: 'Journal or complete a task',
      done: journalRow?.last_date === today || taskRow?.last_date === today,
    },
  ];

  const score = Math.max(0, Math.min(100, Number(profile?.myli_score ?? 0)));
  const appUsageStreak = Math.max(0, Number(profile?.streak_count ?? 0));

  return NextResponse.json({
    appUsageStreak,
    challenges,
    myliScore: score,
  });
}
