import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * MYLI Score (0–999) weights:
 *   - Meal consistency (streak):        25%
 *   - Workout consistency (streak):     25%
 *   - Task completion rate (7d):        20%
 *   - Ritual/journal streak:            15%
 *   - Profile completeness:             15%
 */

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    { data: streaks },
    { data: recentTasks },
    { data: profile },
    { data: physical },
    { data: mental },
  ] = await Promise.all([
    supabase.from('streaks').select('streak_type, current_count').eq('user_id', user.id),
    supabase
      .from('daily_tasks')
      .select('completed')
      .eq('user_id', user.id)
      .gte('due_at', sevenDaysAgo.toISOString()),
    supabase.from('profiles').select('track, onboarding_complete').eq('user_id', user.id).single(),
    supabase.from('physical_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('mental_profiles').select('id').eq('user_id', user.id).maybeSingle(),
  ]);

  const streakMap = new Map((streaks ?? []).map((s) => [s.streak_type, s.current_count]));

  const mealStreak = clamp(streakMap.get('meal') ?? 0, 0, 30);
  const mealScore = (mealStreak / 30) * 250;

  const workoutStreak = clamp(streakMap.get('workout') ?? 0, 0, 30);
  const workoutScore = (workoutStreak / 30) * 250;

  const tasks = recentTasks ?? [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const taskRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const taskScore = taskRate * 200;

  const journalStreak = clamp(streakMap.get('journal') ?? 0, 0, 30);
  const journalScore = (journalStreak / 30) * 150;

  let profilePoints = 0;
  if (profile?.onboarding_complete) profilePoints += 50;
  if (physical) profilePoints += 50;
  if (mental) profilePoints += 50;
  const profileScore = clamp(profilePoints, 0, 150);

  const rawScore = Math.round(mealScore + workoutScore + taskScore + journalScore + profileScore);
  const finalScore = clamp(rawScore, 0, 999);

  await supabase
    .from('profiles')
    .update({ myli_score: finalScore, last_active: new Date().toISOString() })
    .eq('user_id', user.id);

  return NextResponse.json({
    myli_score: finalScore,
    breakdown: {
      meal_streak: { count: mealStreak, points: Math.round(mealScore) },
      workout_streak: { count: workoutStreak, points: Math.round(workoutScore) },
      task_completion: { rate: Math.round(taskRate * 100), points: Math.round(taskScore) },
      journal_streak: { count: journalStreak, points: Math.round(journalScore) },
      profile_completeness: { points: profileScore },
    },
  });
}
