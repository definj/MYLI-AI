import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end query params required (YYYY-MM-DD)' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const startIso = `${start}T00:00:00.000Z`;
  const endIso = `${end}T23:59:59.999Z`;

  const [{ data: meals }, { data: workouts }, { data: tasks }] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('logged_at, meal_type')
      .eq('user_id', user.id)
      .gte('logged_at', startIso)
      .lte('logged_at', endIso),
    supabase
      .from('workout_logs')
      .select('date, completed')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('daily_tasks')
      .select('due_at, completed')
      .eq('user_id', user.id)
      .gte('due_at', startIso)
      .lte('due_at', endIso),
  ]);

  type DayData = {
    meals: number;
    workouts: number;
    tasks: { pending: number; completed: number };
  };

  const map: Record<string, DayData> = {};

  const ensure = (date: string): DayData => {
    if (!map[date]) map[date] = { meals: 0, workouts: 0, tasks: { pending: 0, completed: 0 } };
    return map[date];
  };

  for (const m of meals ?? []) {
    if (!m.logged_at) continue;
    const day = m.logged_at.split('T')[0];
    ensure(day).meals += 1;
  }

  for (const w of workouts ?? []) {
    if (!w.date) continue;
    const day = typeof w.date === 'string' ? w.date : String(w.date);
    ensure(day).workouts += 1;
  }

  for (const t of tasks ?? []) {
    if (!t.due_at) continue;
    const day = t.due_at.split('T')[0];
    const d = ensure(day);
    if (t.completed) d.tasks.completed += 1;
    else d.tasks.pending += 1;
  }

  return NextResponse.json({ data: map });
}
