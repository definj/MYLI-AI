import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicText, safeJsonParse } from '@/lib/ai/anthropic';
import {
  assertWeeklyWorkoutTypesVary,
  buildUserWorkoutProfile,
  buildWeekPlanFromSkeleton,
  enrichDaysWithSkeleton,
  skeletonToPromptBlock,
  tierExperienceForTierIndex,
  validateUniqueDailyProgramming,
  weeklyPlanBuilder,
  type GeneratedWorkoutDay,
  type WeeklyPlanSkeleton,
} from '@/lib/workouts/weekly-plan-builder';

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
  /** Unique label for the day (Push, Pull, Legs, etc.) — must differ across the week */
  workout_type?: string;
  focus_muscles?: string[];
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
  const sorted = [...obj.days].sort((a, b) =>
    String((a as any).date ?? '').localeCompare(String((b as any).date ?? ''))
  );
  const days = sorted
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
      const rawMuscles = (day as any).focus_muscles;
      const focus_muscles = Array.isArray(rawMuscles)
        ? rawMuscles.map((m: unknown) => String(m ?? '').trim()).filter(Boolean)
        : typeof rawMuscles === 'string'
          ? rawMuscles.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
          : undefined;

      return {
        date: String(day.date ?? ''),
        title: String(day.title ?? ''),
        focus: String(day.focus ?? ''),
        workout_type:
          typeof (day as any).workout_type === 'string'
            ? String((day as any).workout_type).trim()
            : undefined,
        focus_muscles,
        exercises,
      } satisfies WorkoutDay;
    })
    .filter((d) => d.date && d.title && (d.focus.trim().length > 0 || d.exercises.length > 0));

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

function workoutDayToGenerated(d: WorkoutDay): GeneratedWorkoutDay {
  return {
    date: d.date,
    title: d.title,
    focus: d.focus,
    workout_type: d.workout_type?.trim() || d.title,
    focus_muscles: d.focus_muscles ?? [],
    exercises: d.exercises,
  };
}

function generatedToWorkoutDay(d: GeneratedWorkoutDay): WorkoutDay {
  return {
    date: d.date,
    title: d.title,
    focus: d.focus,
    workout_type: d.workout_type,
    focus_muscles: d.focus_muscles,
    exercises: d.exercises,
  };
}

function weekPlanFromGenerated(result: ReturnType<typeof buildWeekPlanFromSkeleton>): WeekPlan {
  return {
    week_start: result.week_start,
    split_name: result.split_name,
    days: result.days.map(generatedToWorkoutDay),
  };
}

function ensureTierWeekPlansWithSkeletons(
  payload: WorkoutPlanPayloadV2,
  tierSkeletons: WeeklyPlanSkeleton[]
): WorkoutPlanPayloadV2 {
  const tiers = payload.tiers.map((tier, idx) => {
    const skeleton =
      tierSkeletons[idx] ?? tierSkeletons[tierSkeletons.length - 1] ?? tierSkeletons[0];
    const te = tierExperienceForTierIndex(idx);

    const tierFromAI = normalizeWeekPlan((tier as any).week_plan);

    let week_plan: WeekPlan;

    if (!tierFromAI || tierFromAI.days.length !== 7) {
      week_plan = weekPlanFromGenerated(buildWeekPlanFromSkeleton(skeleton, te));
    } else {
      const genDays = tierFromAI.days.map(workoutDayToGenerated);
      const enriched = enrichDaysWithSkeleton(genDays, skeleton);
      const validated = validateUniqueDailyProgramming(enriched);
      if (!validated.ok) {
        console.warn(`[workout] Tier ${idx} AI output failed uniqueness checks:`, validated.errors);
        week_plan = weekPlanFromGenerated(buildWeekPlanFromSkeleton(skeleton, te));
      } else {
        week_plan = {
          week_start: tierFromAI.week_start,
          split_name: tierFromAI.split_name || skeleton.split_name,
          days: enriched.map(generatedToWorkoutDay),
        };
      }
    }

    assertWeeklyWorkoutTypesVary(week_plan.days.map((d) => d.workout_type || d.title));

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
  const activeTierIndex = typeof body.active_tier_index === 'number' ? Math.floor(body.active_tier_index) : null;

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

    const otherDaysSummary = existingWeek.days
      .filter((d) => d.date !== regenerateDate)
      .map((d) => {
        const ex = d.exercises
          .slice(0, 5)
          .map((e) => e.exercise)
          .join(', ');
        return `- ${d.date}: ${d.workout_type || d.title} — exercises include: ${ex || '(none)'}`;
      })
      .join('\n');

    const targetCtx = existingDay
      ? `This day's assigned type: "${existingDay.workout_type || existingDay.title}". Current focus text: ${existingDay.focus}`
      : '';

    const prompt = `Create a single-day workout for date ${regenerateDate} as part of this weekly split: ${existingWeek.split_name}.${restDayRule}

${targetCtx}

User context: ${profileContext}
Equipment access: ${effectiveEquipment || 'Not specified'}
Typical training style: ${effectiveStyle || 'Not specified'}

OTHER DAYS THIS WEEK (do NOT duplicate their exercise lists or intent):
${otherDaysSummary}

Return strict JSON only for this exact structure:
{
  "date": "YYYY-MM-DD",
  "title": "Short day title matching the assigned workout type",
  "workout_type": "Same label as other days use for this slot (e.g. Push, Pull, Legs)",
  "focus_muscles": ["primary", "muscle", "groups"],
  "focus": "1 sentence focus",
  "exercises": [
    { "exercise": "Exercise Name", "sets": 4, "reps": "6-10", "rest_sec": 90 }
  ]
}

Requirements:
- Proven programming: prioritize big compounds, progressive overload, appropriate volume, and fatigue management.
- The exercise list MUST be meaningfully different from every other day listed above (no copy-paste sessions).
- Include warm-up intent implicitly (first movement ramps), choose exercises that fit the equipment.
- If you output a Rest/Recovery day, it must contain only recovery activities (walk/yoga/mobility/sauna) and NO lifting/HIIT.
- 5-8 exercises total with sensible sets/reps/rest (recovery days: fewer items, duration-based reps).`;

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
          workout_type:
            typeof parsed.workout_type === 'string' ? String(parsed.workout_type).trim() : undefined,
          focus_muscles: Array.isArray(parsed.focus_muscles)
            ? parsed.focus_muscles.map((m: unknown) => String(m ?? '').trim()).filter(Boolean)
            : undefined,
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

  const goalStr = physicalProfile?.goal ?? 'general fitness';
  const tierSkeletons: WeeklyPlanSkeleton[] = [0, 1, 2].map((idx) =>
    weeklyPlanBuilder(
      weekStart,
      buildUserWorkoutProfile({
        goal: goalStr,
        tierIndex: idx,
        tierWeeklyDays: [3, 4, 5][idx],
        equipment,
        trainingStyle,
      })
    )
  );

  const skeletonBlocks = tierSkeletons
    .map(
      (sk, i) =>
        `=== TIER ${i + 1} (tier index ${i}) — REQUIRED WEEKLY STRUCTURE ===\nYou MUST use these exact dates and workout_type strings. Each training day needs a UNIQUE exercise list (no duplicated sessions across the week).\n${skeletonToPromptBlock(sk)}`
    )
    .join('\n\n');

  const prompt = `Create 3 workout plan tiers for this user.
User profile: ${profileContext}
Equipment access: ${equipment || 'Not specified'}
Typical training style: ${trainingStyle || 'Not specified'}

Generate a complete 7-day week plan for EACH tier, starting on ${weekStart} (Monday).
Apply exercise science: progressive overload within the week, alternate muscle groups / stress so heavy lower-body days are not back-to-back with another heavy lower day, and use active recovery between hard sessions where the structure below implies it.

${skeletonBlocks}

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
        "split_name": "Descriptive split name",
        "days": [
          {
            "date": "YYYY-MM-DD",
            "title": "Must align with workout_type for that date",
            "workout_type": "EXACT string from the skeleton for this date",
            "focus_muscles": ["chest", "back"],
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

CRITICAL UNIQUENESS RULES:
- For EACH tier, copy the skeleton's workout_type string for each date EXACTLY (those labels are already unique per day).
- Every training day must have a DIFFERENT exercise prescription than every other training day (no duplicated exercise lists).
- Rest/recovery days: only recovery modalities; title must include "Rest" or "Recovery"; sets=1 and reps as duration where appropriate.

Tier volume:
- Tier 1 (moderate): 3 training days + 4 rest/recovery days. 4-5 exercises per training day.
- Tier 2 (medium): 4 training days + 3 rest/recovery days. 5-6 exercises per training day.
- Tier 3 (intense): 5 training days + 2 rest/recovery days. 6-8 exercises per training day.

REST/RECOVERY DAY RULES (strictly enforced):
- Rest/Recovery days MUST only contain recovery activities: outdoor walk, easy cycling, yoga, mobility, stretching, breathwork, foam rolling, sauna.
- NEVER put lifting, HIIT, sprints, or hard conditioning on a Rest/Recovery day.

Training day rules:
- Start with compound movements (squat, hinge, press, row, carry pattern) where appropriate for that workout_type.
- Match goal: ${goalStr}.
- All 7 days must have dates in order Mon–Sun for the week starting ${weekStart}.
- Every tier.week_plan.days must contain EXACTLY 7 objects.`; 

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
    planPayload = normalized;
  }
  planPayload = ensureTierWeekPlansWithSkeletons(planPayload, tierSkeletons);

  await supabase.from('workout_plans').update({ active: false }).eq('user_id', user.id);

  const inserts = (planPayload.tiers as unknown as WorkoutTierV2[]).map((tier, idx) => {
    const fallbackActiveIndex = planPayload.tiers.length - 1;
    const safeActiveIndex =
      activeTierIndex != null && activeTierIndex >= 0 && activeTierIndex < planPayload.tiers.length
        ? activeTierIndex
        : fallbackActiveIndex;
    const isActive = idx === safeActiveIndex;

    const tierWeekPlan = (tier as any).week_plan
      ? normalizeWeekPlan((tier as any).week_plan) ?? undefined
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
