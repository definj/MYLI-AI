import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type PlanRow = {
  id: string;
  intensity: string;
  generated_at: string;
  active: boolean | null;
  plan_json: {
    week_plan?: {
      week_start: string;
      days: Array<{
        date: string;
        title: string;
        focus?: string;
        workout_type?: string;
      }>;
    };
    meta?: { week_start?: string };
  } | null;
};

function enumerateDatesInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  while (cur <= endD) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Pick scheduled day from DB rows: active plan wins; else newest generated_at. */
function plannedDayForDate(date: string, rows: PlanRow[]) {
  const matches: Array<{
    row: PlanRow;
    day: { date: string; title: string; workout_type?: string };
  }> = [];

  for (const row of rows) {
    const wp = row.plan_json?.week_plan;
    if (!wp?.days?.length) continue;
    const day = wp.days.find((d) => d.date === date);
    if (day) matches.push({ row, day });
  }

  if (matches.length === 0) return null;

  const active = matches.find((m) => m.row.active === true);
  if (active) {
    return {
      title: active.day.title,
      workout_type: active.day.workout_type?.trim() || null,
      intensity: active.row.intensity,
    };
  }

  const sorted = [...matches].sort(
    (a, b) => new Date(b.row.generated_at).getTime() - new Date(a.row.generated_at).getTime()
  );
  const best = sorted[0];
  return {
    title: best.day.title,
    workout_type: best.day.workout_type?.trim() || null,
    intensity: best.row.intensity,
  };
}

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

  const [{ data: meals }, { data: workouts }, { data: tasks }, { data: externalEvents }, { data: planRows }] =
    await Promise.all([
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
    supabase
      .from('calendar_external_events')
      .select('start_at, end_at')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .lte('start_at', endIso)
      .gte('end_at', startIso),
    supabase
      .from('workout_plans')
      .select('id, intensity, generated_at, active, plan_json')
      .eq('user_id', user.id)
      .order('generated_at', { ascending: false })
      .limit(120),
  ]);

  let scheduledCompletions: Array<{ date: string }> | null = null;
  const compRes = await supabase
    .from('workout_scheduled_day_completions')
    .select('date, completed_at')
    .eq('user_id', user.id)
    .gte('date', start)
    .lte('date', end);
  if (compRes.error) {
    console.warn('[calendar/week] workout_scheduled_day_completions:', compRes.error.message);
  } else {
    scheduledCompletions = compRes.data as Array<{ date: string }>;
  }

  type DayData = {
    meals: number;
    workouts: number;
    tasks: { pending: number; completed: number };
    calendar_events: number;
    planned_workout?: {
      title: string;
      workout_type: string | null;
      intensity: string;
      completed: boolean;
    };
  };

  const map: Record<string, DayData> = {};

  const ensure = (date: string): DayData => {
    if (!map[date]) {
      map[date] = {
        meals: 0,
        workouts: 0,
        tasks: { pending: 0, completed: 0 },
        calendar_events: 0,
      };
    }
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

  for (const event of externalEvents ?? []) {
    if (!event.start_at) continue;
    const day = event.start_at.split('T')[0];
    ensure(day).calendar_events += 1;
  }

  const completionByDate: Record<string, boolean> = {};
  for (const c of scheduledCompletions ?? ([] as Array<{ date: string }>)) {
    if (!c.date) continue;
    const d = typeof c.date === 'string' ? c.date : String(c.date);
    completionByDate[d] = true;
  }

  const rows = (planRows ?? []) as PlanRow[];
  for (const date of enumerateDatesInclusive(start, end)) {
    const planned = plannedDayForDate(date, rows);
    if (!planned) continue;
    const d = ensure(date);
    d.planned_workout = {
      title: planned.title,
      workout_type: planned.workout_type,
      intensity: planned.intensity,
      completed: Boolean(completionByDate[date]),
    };
  }

  return NextResponse.json({ data: map });
}
