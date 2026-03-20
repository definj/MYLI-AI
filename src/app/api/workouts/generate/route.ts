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

type WorkoutTierV2 = WorkoutTier & {
  week_plan?: unknown;
};

type WorkoutPlanPayloadV2 = WorkoutPlanPayload & {
  week_plan?: WeekPlan;
};

function addDaysDateOnly(dateOnly: string, days: number) {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

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
    note: `Showing default plans for goal: ${goal || 'general fitness'}. Fill in your equipment and training style above and regenerate for a personalized plan.`,
  };
}

function normalizePlanPayload(input: Partial<WorkoutPlanPayload> | null): WorkoutPlanPayload | null {
  if (!input || !Array.isArray(input.tiers)) return null;

  const tiers = input.tiers
    .map((tier) => ({
      intensity: String((tier as any).intensity ?? ''),
      weekly_days: Number((tier as any).weekly_days ?? 0),
      focus: String((tier as any).focus ?? ''),
      sample_day: Array.isArray((tier as any).sample_day)
        ? (tier as any).sample_day.map((ex: any) => ({
            exercise: String(ex.exercise ?? ''),
            sets: Number(ex.sets ?? 0),
            reps: String(ex.reps ?? ''),
            rest_sec: Number(ex.rest_sec ?? 60),
          }))
        : [],
      ...(((tier as any).week_plan) ? { week_plan: (tier as any).week_plan } : {}),
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
            sets: Number((ex as any).sets ?? 1),
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
    .filter((d) => d.date && d.title && d.focus);

  if (days.length !== 7) {
    console.error(`[workout] normalizeWeekPlan got ${days.length}/7 days — returning null`);
    return null;
  }
  return {
    week_start: obj.week_start,
    split_name: typeof obj.split_name === 'string' ? obj.split_name : 'Weekly Split',
    days,
  };
}

function getTrainingDayIndexes(trainingDays: number): number[] {
  const clamped = Math.max(3, Math.min(6, Math.round(trainingDays)));
  if (clamped <= 3) return [0, 2, 4];
  if (clamped === 4) return [0, 1, 3, 5];
  if (clamped === 5) return [0, 1, 2, 4, 5];
  return [0, 1, 2, 3, 4, 5];
}

function fallbackRecoveryExercises() {
  return [
    { exercise: 'Easy walk', sets: 1, reps: '30-45 min', rest_sec: 0 },
    { exercise: 'Mobility flow', sets: 1, reps: '15-20 min', rest_sec: 0 },
  ];
}

function buildFallbackWeekPlanForTier(tier: WorkoutTier, weekStart: string): WeekPlan {
  const trainingIndexes = new Set(getTrainingDayIndexes(tier.weekly_days));
  const trainingTitleByIndex = [
    'Primary Session A',
    'Primary Session B',
    'Primary Session C',
    'Secondary Session A',
    'Secondary Session B',
    'Secondary Session C',
    'Rest / Recovery',
  ];

  const days: WorkoutDay[] = Array.from({ length: 7 }, (_, dayIndex) => {
    const date = addDaysDateOnly(weekStart, dayIndex);
    const isTrainingDay = trainingIndexes.has(dayIndex);

    if (!isTrainingDay) {
      return {
        date,
        title: 'Rest / Recovery',
        focus: 'Low-intensity recovery and movement quality work.',
        exercises: fallbackRecoveryExercises(),
      };
    }

    return {
      date,
      title: trainingTitleByIndex[dayIndex] ?? 'Training Session',
      focus: tier.focus || 'Progressive overload with quality movement patterns.',
      exercises: tier.sample_day?.length ? tier.sample_day : [
        { exercise: 'Goblet Squat', sets: 3, reps: '8-12', rest_sec: 75 },
        { exercise: 'Dumbbell Bench Press', sets: 3, reps: '8-12', rest_sec: 75 },
        { exercise: 'One-Arm Row', sets: 3, reps: '8-12', rest_sec: 60 },
      ],
    };
  });

  return {
    week_start: weekStart,
    split_name: `${tier.intensity} ${Math.max(3, Math.min(6, Math.round(tier.weekly_days)))}x`,
    days,
  };
}

function ensureTierWeekPlans(payload: WorkoutPlanPayloadV2, weekStart: string): WorkoutPlanPayloadV2 {
  const tiers = payload.tiers.map((tier) => {
    const normalized = normalizeWeekPlan((tier as any).week_plan);
    const week_plan = normalized ?? buildFallbackWeekPlanForTier(tier, weekStart);
    return { ...tier, week_plan };
  });
  return { ...payload, tiers };
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

  const prompt = `Create 3 workout plan tiers for this user.
User profile: ${profileContext}
Equipment access: ${equipment || 'Not specified'}
Typical training style: ${trainingStyle || 'Not specified'}

Generate a complete 7-day week plan for EACH tier, starting on ${weekStart} (Monday).
Use proven strength & hypertrophy programming splits appropriate for each tier's volume.

Return a single JSON object (no markdown, no explanation) with this exact structure:
{
  "tiers": [
    {
      "intensity": "moderate",
      "weekly_days": 3,
      "focus": "Brief description of the training focus",
      "sample_day": [
        { "exercise": "Exercise Name", "sets": 3, "reps": "8-10", "rest_sec": 90 }
      ],
      "week_plan": {
        "week_start": "${weekStart}",
        "split_name": "e.g. Full Body 3x",
        "days": [
          {
            "date": "YYYY-MM-DD",
            "title": "Day label e.g. Full Body A / Push / Rest",
            "focus": "1 sentence describing this day's purpose",
            "exercises": [
              { "exercise": "Exercise Name", "sets": 3, "reps": "8-10", "rest_sec": 90 }
            ]
          }
        ]
      }
    }
  ],
  "note": "Brief explanation of the programming approach"
}

Tier requirements:
- Tier 1 (moderate): 3 days/week training, 4 rest/recovery days. Use Full Body A/B/C split. 4-5 exercises per training day.
- Tier 2 (medium): 4-5 days/week training, 2-3 rest/recovery days. Use Upper/Lower or Push/Pull. 5-6 exercises per training day.
- Tier 3 (intense): 5-6 days/week training, 1-2 rest/recovery days. Use PPL or PPL+Upper/Lower hybrid. 6-8 exercises per training day.

REST/RECOVERY DAY RULES (strictly enforced):
- Rest/Recovery days MUST only contain recovery activities: outdoor walk, easy cycling, yoga, mobility, stretching, breathwork, foam rolling, sauna.
- NEVER put lifting, HIIT, sprints, or hard conditioning on a Rest/Recovery day.
- For recovery activities use sets=1 and reps as a duration string like "30-45 min".
- Title must include "Rest" or "Recovery".

Training day rules:
- Start with compound movements (squat, hinge, press, row, carry pattern).
- Use progressive overload-friendly rep ranges (strength: 3-6, hypertrophy: 6-12, endurance: 12-20).
- Choose exercises appropriate for the equipment available.
- Match goal: ${physicalProfile?.goal ?? 'general fitness'}.
- Avoid repeating identical sessions back-to-back.
- All 7 days must have a date matching the week of ${weekStart}.
- Every tier must include week_plan with week_plan.days containing EXACTLY 7 day objects (one per date) for the week of ${weekStart}.
- Tier 1 must have exactly 3 training days + 4 rest/recovery days.
- Tier 2 must have exactly 4-5 training days + 2-3 rest/recovery days.
- Tier 3 must have exactly 5-6 training days + 1-2 rest/recovery days.`; 

  const ai = await callAnthropicText(
    [{ role: 'user', content: prompt }],
    'You are an expert strength and conditioning coach. Return strict JSON only, no markdown fences.'
  );

  const fallback = fallbackPlans(physicalProfile?.goal ?? '');
  let planPayload: WorkoutPlanPayloadV2 = fallback;

  if (!ai.ok) {
    console.error('[workout] AI call failed:', (ai as any).error ?? 'unknown error');
  } else {
    const parsed = safeJsonParse<Partial<WorkoutPlanPayloadV2>>(ai.text);
    if (!parsed) {
      console.error('[workout] Failed to parse AI JSON response. Raw text:', ai.text?.slice(0, 500));
    }
    const normalized = normalizePlanPayload(parsed) ?? fallback;
    const weekPlan = normalizeWeekPlan((parsed as any)?.week_plan) ?? undefined;
    planPayload = { ...normalized, ...(weekPlan ? { week_plan: weekPlan } : {}) };
  }
  planPayload = ensureTierWeekPlans(planPayload, weekStart);

  await supabase.from('workout_plans').update({ active: false }).eq('user_id', user.id);

  const inserts = (planPayload.tiers as unknown as WorkoutTierV2[]).map((tier, idx) => {
    const isActive = idx === planPayload.tiers.length - 1;

    const tierWeekPlan =
      (tier as any).week_plan
        ? normalizeWeekPlan((tier as any).week_plan)
        : isActive
          ? planPayload.week_plan ?? undefined
          : undefined;

    const enriched = {
      ...tier,
      meta: { equipment, training_style: trainingStyle, week_start: weekStart },
      ...(tierWeekPlan ? { week_plan: tierWeekPlan } : {}),
    };

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
