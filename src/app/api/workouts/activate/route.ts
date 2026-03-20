import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({} as Record<string, unknown>))) as {
    intensity?: string;
    week_start?: string;
  };

  const intensity = typeof body.intensity === 'string' ? body.intensity : '';
  const weekStart = typeof body.week_start === 'string' ? body.week_start : '';

  if (!intensity || !weekStart) {
    return NextResponse.json({ error: 'Missing intensity or week_start.' }, { status: 400 });
  }

  const { data: plans, error: fetchError } = await supabase
    .from('workout_plans')
    .select('id, intensity, generated_at, plan_json')
    .eq('user_id', user.id)
    .eq('intensity', intensity)
    .order('generated_at', { ascending: false })
    .limit(12);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const target = (plans ?? []).find(
    (plan) => (plan.plan_json as { week_plan?: { week_start?: string } } | null)?.week_plan?.week_start === weekStart
  );

  if (!target) {
    return NextResponse.json({ error: 'Could not find matching plan tier to activate.' }, { status: 404 });
  }

  await supabase.from('workout_plans').update({ active: false }).eq('user_id', user.id);

  const { error: activateError } = await supabase
    .from('workout_plans')
    .update({ active: true })
    .eq('id', target.id)
    .eq('user_id', user.id);

  if (activateError) return NextResponse.json({ error: activateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: target.id });
}
