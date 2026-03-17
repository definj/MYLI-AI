import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicText, safeJsonParse } from '@/lib/ai/anthropic';

function fallbackPlans(goal: string) {
  return {
    tiers: [
      { intensity: 'moderate', weekly_days: 3, focus: 'Technique and recovery' },
      { intensity: 'medium', weekly_days: 4, focus: 'Progressive overload' },
      { intensity: 'intense', weekly_days: 6, focus: 'Advanced split with volume tracking' },
    ],
    note: `Generated fallback plans for goal: ${goal || 'general fitness'}`,
  };
}

type WorkoutPlanPayload = {
  tiers: Array<{
    intensity: string;
    weekly_days: number;
    focus: string;
    sample_day?: unknown;
  }>;
  note: string;
};

function normalizePlanPayload(input: Partial<WorkoutPlanPayload> | null): WorkoutPlanPayload | null {
  if (!input || !Array.isArray(input.tiers)) return null;

  const tiers = input.tiers
    .map((tier) => ({
      intensity: String(tier.intensity ?? ''),
      weekly_days: Number(tier.weekly_days ?? 0),
      focus: String(tier.focus ?? ''),
      sample_day: tier.sample_day,
    }))
    .filter((tier) => tier.intensity && Number.isFinite(tier.weekly_days) && tier.weekly_days > 0 && tier.focus);

  if (tiers.length === 0) return null;
  return {
    tiers,
    note: String(input.note ?? 'AI generated workout plan tiers.'),
  };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: physicalProfile } = await supabase
    .from('physical_profiles')
    .select('goal, activity_level, age, sex')
    .eq('user_id', user.id)
    .single();

  const prompt = `Create 3 workout plan tiers in JSON only. User profile: ${JSON.stringify(
    physicalProfile ?? {}
  )}. Return: { tiers: [{ intensity, weekly_days, focus, sample_day }], note }`;

  const ai = await callAnthropicText([{ role: 'user', content: prompt }], 'You are a fitness programming assistant.');
  const fallback = fallbackPlans(physicalProfile?.goal ?? '');
  let planPayload: WorkoutPlanPayload = fallback;
  if (ai.ok) {
    const parsed = safeJsonParse<Partial<WorkoutPlanPayload>>(ai.text);
    planPayload = normalizePlanPayload(parsed) ?? fallback;
  }

  await supabase.from('workout_plans').insert([
    { user_id: user.id, intensity: 'moderate', plan_json: planPayload, active: false },
    { user_id: user.id, intensity: 'medium', plan_json: planPayload, active: false },
    { user_id: user.id, intensity: 'intense', plan_json: planPayload, active: true },
  ]);

  return NextResponse.json(planPayload);
}
