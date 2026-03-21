import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST — mark a calendar date as "completed" for the scheduled plan (persists across sessions).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date (YYYY-MM-DD).' }, { status: 400 });
  }

  const completed_at = new Date().toISOString();

  const { data: existing } = await supabase
    .from('workout_scheduled_day_completions')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from('workout_scheduled_day_completions')
        .update({ completed_at })
        .eq('user_id', user.id)
        .eq('date', date)
    : await supabase.from('workout_scheduled_day_completions').insert({
        user_id: user.id,
        date,
        completed_at,
      });

  if (error) {
    console.error('[plan-day/complete]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date query required (YYYY-MM-DD).' }, { status: 400 });
  }

  const { error } = await supabase
    .from('workout_scheduled_day_completions')
    .delete()
    .eq('user_id', user.id)
    .eq('date', date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
