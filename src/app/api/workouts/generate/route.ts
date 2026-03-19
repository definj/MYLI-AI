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

type WorkoutDay = {
  date: string; // YYYY-MM-DD
  title: string;
  focus: string;
  exercises: Array<{
    exercise: string;
    sets: number;
    reps: string;
    rest_sec: number;
  }>;
};

type WeekPlan = {
  week_start: string; // YYYY-MM-DD
  split_name: string;
  days: WorkoutDay[]; // length 7
};

type WorkoutPlanPayload = {
  tiers: WorkoutTier[];
  note: string;
};

type WorkoutPlanPayloadV2 = WorkoutPlanPayload & {
  week_plan?: WeekPlan;
};

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeekMonday(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

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

function normalizeWeekPlan(input: unknown): WeekPlan | null {
  const obj = input as Partial<WeekPlan> | null;
  if (!obj || typeof obj.week_start !== 'string' || !Array.isArray(obj.days)) return null;
  const days = obj.days
    .map((d) => {
      const day = d as Partial<WorkoutDay>;
      const exercises = Array.isArray(day.exercises)
        ? day.exercises.map((ex) => ({
            exercise: String((ex as any).exercise ?? ''),
            sets: Number((ex as any).sets ?? 0),
            reps: String((ex as any).reps ?? ''),
            rest_sec: Number((ex as any).rest_sec ?? 60),
          }))
        : [];
      return {
        date: String(day.date ?? ''),
        title: String(day.title ?? ''),
        focus: String(day.focus ?? ''),
        exercises,
      } satisfies WorkoutDay;
    })
    .filter((d) => d.date && d.title && d.focus && d.exercises.length > 0);

  if (days.length !== 7) return null;
  return {
    week_start: obj.week_start,
    split_name: typeof obj.split_name === 'string' ? obj.split_name : 'Weekly Split',
    days,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({} as any));
  const scope = typeof body.scope === 'string' ? body.scope : 'week';
  const equipment = typeof body.equipment === 'string' ? body.equipment : '';
  const trainingStyle = typeof body.training_style === 'string' ? body.training_style : '';
  const weekStart = typeof body.week_start === 'string' ? body.week_start : toDateOnly(startOfWeekMonday(new Date()));
  const regenerateDate = typeof body.date === 'string' ? body.date : null;

  const { data: physicalProfile } = await supabase
    .from('physical_profiles')
    .select('goal, activity_level, age, sex, weight_kg')
    .eq('user_id', user.id)
    .single();

  const profileContext = physicalProfile
    ? `Age: ${physicalProfile.age}, Sex: ${physicalProfile.sex}, Weight: ${physicalProfile.weight_kg}kg, Activity: ${physicalProfile.activity_level}, Goal: ${physicalProfile.goal}`
    : 'No profile data available, create general fitness plans';

  if (scope === 'day') {
    // Regenerate only one day inside the active week plan.
    const { data: active } = await supabase
      .from('workout_plans')
      .select('id, plan_json')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('generated_at', { ascending: false })
      .maybeSingle();

    const existingWeek = (active?.plan_json as any)?.week_plan as WeekPlan | undefined;
    const meta = (active?.plan_json as any)?.meta as { equipment?: string; training_style?: string } | undefined;
    const effectiveEquipment = equipment || meta?.equipment || '';
    const effectiveStyle = trainingStyle || meta?.training_style || '';

    if (!existingWeek || !regenerateDate) {
      return NextResponse.json({ error: 'Missing active week plan or date.' }, { status: 400 });
    }

    const existingDay = existingWeek.days.find((d) => d.date === regenerateDate);
    const restDayRule = existingDay && /rest|recovery|active recovery/i.test(existingDay.title)
      ? `\nRest day rule: This day is a REST/RECOVERY day. You MUST only output recovery activities (outdoor walk, easy bike, yoga, mobility, stretching, breathwork, sauna). Do NOT include lifting, HIIT, sprints, or hard conditioning. Use reps as a duration string like "30-45 min" and sets=1 for recovery items.`
      : '';

    const prompt = `Create a single-day workout for date ${regenerateDate} as part of this weekly split: ${existingWeek.split_name}.${restDayRule}

User context: ${profileContext}
Equipment access: ${effectiveEquipment || 'Not specified'}
Typical training style: ${effectiveStyle || 'Not specified'}

Return strict JSON only for this exact structure:
{
  "date": "YYYY-MM-DD",
  "title": "Day title (e.g. Push A / Lower / Conditioning)",
  "focus": "1 sentence focus",
  "exercises": [
    { "exercise": "Exercise Name", "sets": 4, "reps": "6-10", "rest_sec": 90 }
  ]
}

Requirements:
- Proven programming: prioritize big compounds, progressive overload, appropriate volume, and fatigue management.
- Match the goal and weekly split, avoid repeating the exact same session back-to-back.
- Include warm-up intent implicitly (first movement ramps), choose exercises that fit the equipment.
- If you output a Rest/Recovery day, it must contain only recovery activities (walk/yoga/mobility/sauna) and NO lifting/HIIT.
- 5-8 exercises total with sensible sets/reps/rest.`;

    const ai = await callAnthropicText(
      [{ role: 'user', content: prompt }],
      'You are an elite strength & conditioning coach. Return strict JSON only.'
    );

    const parsed = ai.ok ? safeJsonParse<any>(ai.text) : null;
    const day: WorkoutDay | null = parsed && typeof parsed.date === 'string'
      ? {
          date: String(parsed.date),
          title: String(parsed.title ?? ''),
          focus: String(parsed.focus ?? ''),
          exercises: Array.isArray(parsed.exercises)
            ? parsed.exercises.map((ex: any) => ({
                exercise: String(ex.exercise ?? ''),
                sets: Number(ex.sets ?? 0),
                reps: String(ex.reps ?? ''),
                rest_sec: Number(ex.rest_sec ?? 60),
              })).filter((ex: any) => ex.exercise && ex.sets > 0 && ex.reps)
            : [],
        }
      : null;

    if (!day || day.exercises.length === 0) {
      return NextResponse.json({ error: 'Unable to regenerate day workout.' }, { status: 500 });
    }

    const nextWeek: WeekPlan = {
      ...existingWeek,
      days: existingWeek.days.map((d) => (d.date === regenerateDate ? day : d)),
    };

    if (active?.id) {
      await supabase
        .from('workout_plans')
        .update({ plan_json: { ...(active.plan_json as any), week_plan: nextWeek } })
        .eq('id', active.id)
        .eq('user_id', user.id);
    }

    return NextResponse.json({ ok: true, week_plan: nextWeek, day });
  }

  const prompt = `Create 3 workout plan tiers for this user. ${profileContext}
Equipment access: ${equipment || 'Not specified'}
Typical training style: ${trainingStyle || 'Not specified'}

Additionally, for Tier 3 (the intense tier), generate a complete 7-day week plan starting on ${weekStart} (Monday) with a proven split (e.g. PPL, Upper/Lower, or PPL+Upper) based on best-practice strength & hypertrophy programming.

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
  \"week_plan\": {\n    \"week_start\": \"YYYY-MM-DD\",\n    \"split_name\": \"e.g. Push/Pull/Legs + Upper/Lower\",\n    \"days\": [\n      {\n        \"date\": \"YYYY-MM-DD\",\n        \"title\": \"Day title\",\n        \"focus\": \"1 sentence focus\",\n        \"exercises\": [\n          { \"exercise\": \"Exercise Name\", \"sets\": 4, \"reps\": \"6-10\", \"rest_sec\": 90 }\n        ]\n      }\n    ]\n  },\n
  "note": "Brief explanation of the programming approach"
}

Requirements:
- Tier 1 (moderate): 3 days/week, full-body or simple split, 4-5 exercises per day
- Tier 2 (medium): 4-5 days/week, upper/lower or push/pull split, 5-6 exercises per day  
- Tier 3 (intense): 5-6 days/week, PPL or body-part split, 6-8 exercises per day
- Each sample_day should have realistic exercises matching the user's goal
- Include compound movements as primary exercises
- reps should be a string like "8-10" or "12-15"
- rest_sec should be 30-120 seconds
- For week_plan.days: include exactly 7 days with dates matching the week starting ${weekStart}. Include 1-2 Rest/Recovery days as needed for recovery and long-term progress.
- Rest/Recovery day rule: Rest/Recovery days MUST only contain recovery activities (outdoor walk, easy bike, yoga, mobility, stretching, breathwork, sauna). Do NOT include lifting, HIIT, sprints, or hard conditioning on Rest/Recovery days. Use reps as a duration string like "30-45 min" and sets=1 for recovery items.
- Choose exercises that fit the equipment access and training style; prioritize proven lifts and programming.`; 

  const ai = await callAnthropicText(
    [{ role: 'user', content: prompt }],
    'You are an expert strength and conditioning coach. Return strict JSON only, no markdown fences.'
  );

  const fallback = fallbackPlans(physicalProfile?.goal ?? '');
  let planPayload: WorkoutPlanPayloadV2 = fallback;
  if (ai.ok) {
    const parsed = safeJsonParse<Partial<WorkoutPlanPayloadV2>>(ai.text);
    const normalized = normalizePlanPayload(parsed) ?? fallback;
    const weekPlan = normalizeWeekPlan((parsed as any)?.week_plan) ?? undefined;
    planPayload = { ...normalized, ...(weekPlan ? { week_plan: weekPlan } : {}) };
  }

  await supabase.from('workout_plans').update({ active: false }).eq('user_id', user.id);

  const inserts = planPayload.tiers.map((tier, idx) => {
    const isActive = idx === planPayload.tiers.length - 1;
    const isTier3 = isActive;
    const enriched = isTier3
      ? {
          ...tier,
          meta: { equipment, training_style: trainingStyle, week_start: weekStart },
          ...(planPayload.week_plan ? { week_plan: planPayload.week_plan } : {}),
        }
      : tier;

    return {
      user_id: user.id,
      intensity: tier.intensity,
      plan_json: enriched,
      active: isActive,
    };
  });

  await supabase.from('workout_plans').insert(inserts);

  return NextResponse.json(planPayload);
}
