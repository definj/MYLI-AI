import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type BadgeDef = {
  key: string;
  title: string;
  description: string;
};

const BADGES: BadgeDef[] = [
  { key: 'first_meal', title: 'First Meal Logged', description: 'Log your first meal with photo analysis.' },
  { key: 'streak_7', title: '7-Day Streak', description: 'Maintain any streak for 7 consecutive days.' },
  { key: 'streak_30', title: '30-Day Streak', description: 'Maintain any streak for 30 consecutive days.' },
  { key: 'workout_warrior', title: 'Workout Warrior', description: 'Complete 10 workout sessions.' },
  { key: 'mind_master', title: 'Mind Master', description: 'Complete 20 tasks.' },
  { key: 'vitamin_scholar', title: 'Vitamin Scholar', description: 'Generate your first vitamin analysis report.' },
  { key: 'iron_will', title: 'Iron Will', description: 'Reach a MYLI Score of 500.' },
  { key: 'coach_session', title: 'Guided Path', description: 'Have your first AI Coach conversation.' },
  { key: 'social_butterfly', title: 'Social Butterfly', description: 'Share your first post on the social feed.' },
  { key: 'score_750', title: 'Elite Performer', description: 'Reach a MYLI Score of 750.' },
];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [
    { data: existing },
    { count: mealCount },
    { data: streaks },
    { count: workoutCount },
    { count: taskCount },
    { count: vitaminCount },
    { data: profile },
    { count: postCount },
  ] = await Promise.all([
    supabase.from('user_achievements').select('badge_key').eq('user_id', user.id),
    supabase.from('meal_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('streaks').select('streak_type, current_count, longest_count').eq('user_id', user.id),
    supabase.from('workout_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('completed', true),
    supabase.from('daily_tasks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('completed', true),
    supabase.from('vitamin_analysis').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('profiles').select('myli_score').eq('user_id', user.id).single(),
    supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const unlocked = new Set((existing ?? []).map((a) => a.badge_key));
  const allStreaks = streaks ?? [];
  const maxCurrent = Math.max(0, ...allStreaks.map((s) => s.current_count));
  const maxLongest = Math.max(0, ...allStreaks.map((s) => s.longest_count));
  const bestStreak = Math.max(maxCurrent, maxLongest);
  const score = profile?.myli_score ?? 0;

  const conditions: Record<string, boolean> = {
    first_meal: (mealCount ?? 0) >= 1,
    streak_7: bestStreak >= 7,
    streak_30: bestStreak >= 30,
    workout_warrior: (workoutCount ?? 0) >= 10,
    mind_master: (taskCount ?? 0) >= 20,
    vitamin_scholar: (vitaminCount ?? 0) >= 1,
    iron_will: score >= 500,
    coach_session: true,
    social_butterfly: (postCount ?? 0) >= 1,
    score_750: score >= 750,
  };

  const newlyUnlocked: string[] = [];
  for (const badge of BADGES) {
    if (!unlocked.has(badge.key) && conditions[badge.key]) {
      newlyUnlocked.push(badge.key);
    }
  }

  if (newlyUnlocked.length > 0) {
    await supabase.from('user_achievements').insert(
      newlyUnlocked.map((key) => ({ user_id: user.id, badge_key: key }))
    );
  }

  const allBadges = BADGES.map((badge) => ({
    ...badge,
    unlocked: unlocked.has(badge.key) || newlyUnlocked.includes(badge.key),
    newly_unlocked: newlyUnlocked.includes(badge.key),
  }));

  return NextResponse.json({ badges: allBadges, newly_unlocked: newlyUnlocked });
}
