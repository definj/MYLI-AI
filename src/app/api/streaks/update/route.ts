import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type StreakType = 'meal' | 'workout' | 'journal' | 'task';

function isConsecutiveDay(lastDate: string | null, today: string): boolean {
  if (!lastDate) return true;
  const last = new Date(lastDate);
  const now = new Date(today);
  const diffMs = now.getTime() - last.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

function isSameDay(lastDate: string | null, today: string): boolean {
  return lastDate === today;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { streak_type?: string };
  const streakType = body.streak_type as StreakType | undefined;

  if (!streakType || !['meal', 'workout', 'journal', 'task'].includes(streakType)) {
    return NextResponse.json({ error: 'Invalid streak_type. Use: meal, workout, journal, task.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const todayStr = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('streaks')
    .select('id, current_count, longest_count, last_date')
    .eq('user_id', user.id)
    .eq('streak_type', streakType)
    .maybeSingle();

  if (existing) {
    if (isSameDay(existing.last_date, todayStr)) {
      return NextResponse.json({
        streak_type: streakType,
        current_count: existing.current_count,
        longest_count: existing.longest_count,
        already_logged_today: true,
      });
    }

    const consecutive = isConsecutiveDay(existing.last_date, todayStr);
    const newCount = consecutive ? existing.current_count + 1 : 1;
    const newLongest = Math.max(existing.longest_count, newCount);

    await supabase
      .from('streaks')
      .update({ current_count: newCount, longest_count: newLongest, last_date: todayStr })
      .eq('id', existing.id);

    return NextResponse.json({
      streak_type: streakType,
      current_count: newCount,
      longest_count: newLongest,
      already_logged_today: false,
    });
  }

  await supabase.from('streaks').insert({
    user_id: user.id,
    streak_type: streakType,
    current_count: 1,
    longest_count: 1,
    last_date: todayStr,
  });

  return NextResponse.json({
    streak_type: streakType,
    current_count: 1,
    longest_count: 1,
    already_logged_today: false,
  });
}
