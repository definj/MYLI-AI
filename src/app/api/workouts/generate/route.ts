import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Per-day AI × 3 tiers can exceed default serverless timeouts (e.g. 10s on Vercel Hobby). */
export const maxDuration = 300;
import { callAnthropicText, safeJsonParse } from '@/lib/ai/anthropic';
import { countTrainingLikeDays, resolveGoalPreset, SEVEN_DAY_PRESETS } from '@/lib/workouts/goal-presets';
import { generateWeekPlanWithDailyAI, type ApiWorkoutDay } from '@/lib/workouts/generate-week-daily';
import {
  buildUserWorkoutProfile,
  tierExperienceForTierIndex,
  weeklyPlanBuilder,
  type WeeklyPlanSkeleton,
} from '@/lib/workouts/weekly-plan-builder';

type WorkoutDay = {
  date: string; // YYYY-MM-DD
  day_name?: string;
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
  week_plan?: WeekPlan;
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
        day_name: typeof (day as any).day_name === 'string' ? String((day as any).day_name) : undefined,
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
    .filter(
      (d) =>
        d.date &&
        (d.title?.trim() || d.workout_type?.trim()) &&
        (d.focus.trim().length > 0 || d.exercises.length > 0)
    );

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

function apiDayToWorkoutDay(d: ApiWorkoutDay): WorkoutDay {
  return {
    date: d.date,
    day_name: d.day_name,
    title: d.title,
    focus: d.focus,
    workout_type: d.workout_type,
    focus_muscles: d.focus_muscles,
    exercises: d.exercises,
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
  const activeTierIndex = typeof body.active_tier_index === 'number' ? Math.floor(body.active_tier_index) : null;

  const { data: physicalProfile } = await supabase
    .from('physical_profiles')
    .select('goal, activity_level, age, sex, weight_kg')
    .eq('user_id', user.id)
    .maybeSingle();

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
  const presetKey = resolveGoalPreset(goalStr);
  const weeklyDaysFromPreset = countTrainingLikeDays(SEVEN_DAY_PRESETS[presetKey]);

  const tierSkeletons: WeeklyPlanSkeleton[] = [0, 1, 2].map((idx) =>
    weeklyPlanBuilder(
      weekStart,
      buildUserWorkoutProfile({
        goal: goalStr,
        tierIndex: idx,
        equipment,
        trainingStyle,
      })
    )
  );

  let planPayload: WorkoutPlanPayloadV2;

  try {
    const generatedTiers = await Promise.all(
      [0, 1, 2].map((tierIdx) =>
        generateWeekPlanWithDailyAI({
          skeleton: tierSkeletons[tierIdx],
          profileContext,
          equipment,
          trainingStyle,
          tierExperience: tierExperienceForTierIndex(tierIdx),
          tierIndex: tierIdx,
        })
      )
    );

    const tiersBuilt: WorkoutTier[] = [];

    for (let tierIdx = 0; tierIdx < generatedTiers.length; tierIdx++) {
      const generated = generatedTiers[tierIdx];

      const week_plan: WeekPlan = {
        week_start: generated.week_start,
        split_name: generated.split_name,
        days: generated.days.map(apiDayToWorkoutDay),
      };

      const intensity = tierIdx === 0 ? 'moderate' : tierIdx === 1 ? 'medium' : 'intense';
      const trainingSlice = week_plan.days.find(
        (d) => d.exercises.length > 0 && !/rest|recovery/i.test(d.workout_type || d.title)
      );
      const sample_day =
        trainingSlice?.exercises.slice(0, 5) ?? week_plan.days[0].exercises.slice(0, 3);

      tiersBuilt.push({
        intensity,
        weekly_days: weeklyDaysFromPreset,
        focus: `${presetKey} · ${intensity} · day-by-day generation`,
        sample_day,
        week_plan,
      });
    }

    planPayload = {
      tiers: tiersBuilt,
      note: `7-day ${presetKey} split. Each training day was generated separately with cumulative exercise tracking so sessions stay unique.`,
    };
  } catch (err) {
    console.error('[workout] week generation failed:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Workout generation failed. Ensure ANTHROPIC_API_KEY is set and try again.',
      },
      { status: 500 }
    );
  }

  await supabase.from('workout_plans').update({ active: false }).eq('user_id', user.id);

  // Replace existing rows for this week so we don't accumulate duplicate tiers (upsert behavior).
  const { data: existingPlans } = await supabase
    .from('workout_plans')
    .select('id, plan_json')
    .eq('user_id', user.id);

  const idsToReplace = (existingPlans ?? [])
    .filter((row) => {
      const meta = (row.plan_json as { meta?: { week_start?: string } } | null)?.meta;
      return meta?.week_start === weekStart;
    })
    .map((r) => r.id);

  if (idsToReplace.length > 0) {
    await supabase.from('workout_plans').delete().in('id', idsToReplace);
  }

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
