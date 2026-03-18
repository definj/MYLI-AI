import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicText, safeJsonParse } from '@/lib/ai/anthropic';

type WorkoutTier = {
  intensity: string;
  weekly_days: number;
  focus: string;
  sample_day: Array<{
    exercise: string;
    sets: number;
    reps: string;
    rest_sec: number;
  }>;
};

type WorkoutPlanPayload = {
  tiers: WorkoutTier[];
  note: string;
};

function fallbackPlans(goal: string): WorkoutPlanPayload {
  const sampleExercises = [
    { exercise: 'Barbell Squat', sets: 4, reps: '8-10', rest_sec: 90 },
    { exercise: 'Romanian Deadlift', sets: 3, reps: '10-12', rest_sec: 90 },
    { exercise: 'Bench Press', sets: 4, reps: '8-10', rest_sec: 90 },
    { exercise: 'Bent Over Row', sets: 3, reps: '10-12', rest_sec: 60 },
    { exercise: 'Overhead Press', sets: 3, reps: '8-10', rest_sec: 60 },
  ];

  return {
    tiers: [
      {
        intensity: 'moderate',
        weekly_days: 3,
        focus: 'Full-body technique and recovery',
        sample_day: sampleExercises.slice(0, 3),
      },
      {
        intensity: 'medium',
        weekly_days: 4,
        focus: 'Upper/lower split with progressive overload',
        sample_day: sampleExercises.slice(0, 4),
      },
      {
        intensity: 'intense',
        weekly_days: 6,
        focus: 'Push/pull/legs split with volume tracking',
        sample_day: sampleExercises,
      },
    ],
    note: `Fallback plans for goal: ${goal || 'general fitness'}. Connect your Anthropic API key for personalized plans.`,
  };
}

function normalizePlanPayload(input: Partial<WorkoutPlanPayload> | null): WorkoutPlanPayload | null {
  if (!input || !Array.isArray(input.tiers)) return null;

  const tiers = input.tiers
    .map((tier) => ({
      intensity: String(tier.intensity ?? ''),
      weekly_days: Number(tier.weekly_days ?? 0),
      focus: String(tier.focus ?? ''),
      sample_day: Array.isArray(tier.sample_day)
        ? tier.sample_day.map((ex) => ({
            exercise: String((ex as Record<string, unknown>).exercise ?? ''),
            sets: Number((ex as Record<string, unknown>).sets ?? 0),
            reps: String((ex as Record<string, unknown>).reps ?? ''),
            rest_sec: Number((ex as Record<string, unknown>).rest_sec ?? 60),
          }))
        : [],
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
    .select('goal, activity_level, age, sex, weight_kg')
    .eq('user_id', user.id)
    .single();

  const profileContext = physicalProfile
    ? `Age: ${physicalProfile.age}, Sex: ${physicalProfile.sex}, Weight: ${physicalProfile.weight_kg}kg, Activity: ${physicalProfile.activity_level}, Goal: ${physicalProfile.goal}`
    : 'No profile data available, create general fitness plans';

  const prompt = `Create 3 workout plan tiers for this user. ${profileContext}.

Return a single JSON object (no markdown, no explanation) with this exact structure:
{
  "tiers": [
    {
      "intensity": "moderate",
      "weekly_days": 3,
      "focus": "description of the training focus",
      "sample_day": [
        { "exercise": "Exercise Name", "sets": 4, "reps": "8-10", "rest_sec": 90 }
      ]
    }
  ],
  "note": "Brief explanation of the programming approach"
}

Requirements:
- Tier 1 (moderate): 3 days/week, full-body or simple split, 4-5 exercises per day
- Tier 2 (medium): 4-5 days/week, upper/lower or push/pull split, 5-6 exercises per day  
- Tier 3 (intense): 5-6 days/week, PPL or body-part split, 6-8 exercises per day
- Each sample_day should have realistic exercises matching the user's goal
- Include compound movements as primary exercises
- reps should be a string like "8-10" or "12-15"
- rest_sec should be 30-120 seconds`;

  const ai = await callAnthropicText(
    [{ role: 'user', content: prompt }],
    'You are an expert strength and conditioning coach. Return strict JSON only, no markdown fences.'
  );

  const fallback = fallbackPlans(physicalProfile?.goal ?? '');
  let planPayload: WorkoutPlanPayload = fallback;
  if (ai.ok) {
    const parsed = safeJsonParse<Partial<WorkoutPlanPayload>>(ai.text);
    planPayload = normalizePlanPayload(parsed) ?? fallback;
  }

  await supabase.from('workout_plans').update({ active: false }).eq('user_id', user.id);

  const inserts = planPayload.tiers.map((tier, idx) => ({
    user_id: user.id,
    intensity: tier.intensity,
    plan_json: tier,
    active: idx === planPayload.tiers.length - 1,
  }));

  await supabase.from('workout_plans').insert(inserts);

  return NextResponse.json(planPayload);
}
