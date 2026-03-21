import { callAnthropicText, safeJsonParse } from '@/lib/ai/anthropic';
import {
  buildFallbackExercisesForDay,
  type DaySkeleton,
  type TierExperience,
  type WeeklyPlanSkeleton,
} from './weekly-plan-builder';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type ApiWorkoutDay = {
  date: string;
  day_name?: string;
  title: string;
  focus: string;
  workout_type?: string;
  focus_muscles?: string[];
  exercises: Array<{
    exercise: string;
    sets: number;
    reps: string;
    rest_sec: number;
  }>;
};

function normalizeExerciseKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function exerciseFingerprint(day: ApiWorkoutDay): string {
  return day.exercises
    .map((e) => normalizeExerciseKey(e.exercise))
    .filter(Boolean)
    .sort()
    .join('|');
}

/**
 * Dev-only diagnostic: never throws (would break generation for users).
 * Set WORKOUT_STRICT_VALIDATE=true to throw in dev when debugging.
 */
export function assertWeekExerciseVarietyDev(days: ApiWorkoutDay[]): void {
  const training = days.filter((d) => !/rest|recovery/i.test(d.workout_type || d.title));
  if (training.length < 3) return;
  const fps = training.map((d) => exerciseFingerprint(d));
  const unique = new Set(fps);
  if (unique.size < 3) {
    const msg = `[workout] Variety check: only ${unique.size} unique training-day fingerprints (expected >=3).`;
    console.warn(msg);
    if (process.env.WORKOUT_STRICT_VALIDATE === 'true' && process.env.NODE_ENV !== 'production') {
      throw new Error(
        `WORKOUT BUG: Week contains too many duplicate training days (${unique.size} unique fingerprints).`
      );
    }
  }
}

function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

function isRestLikeSkeleton(sk: DaySkeleton): boolean {
  return (
    sk.dayRole === 'rest' ||
    sk.dayRole === 'recovery' ||
    /rest|recovery/i.test(sk.workoutType)
  );
}

function exerciseRangeForTier(tier: TierExperience): { min: number; max: number } {
  if (tier === 'beginner') return { min: 4, max: 5 };
  if (tier === 'intermediate') return { min: 5, max: 6 };
  return { min: 6, max: 8 };
}

async function callOneDayAI(prompt: string): Promise<ApiWorkoutDay | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ai = await callAnthropicText(
      [{ role: 'user', content: prompt }],
      'You are an elite strength & conditioning coach. Return strict JSON only, no markdown fences.',
      { max_tokens: 2048 }
    );
    if (!ai.ok) {
      console.error('[workout] daily AI failed:', (ai as any).error);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
      continue;
    }
    const parsed = tryParseDay(ai.text);
    if (parsed) return parsed;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

function tryParseDay(text: string | undefined): ApiWorkoutDay | null {
  if (!text) return null;
  const parsed = safeJsonParse<Record<string, unknown>>(text);
  if (!parsed || typeof parsed.date !== 'string') return null;

  const exercises = Array.isArray(parsed.exercises)
    ? (parsed.exercises as any[])
        .map((ex) => ({
          exercise: String(ex.exercise ?? ''),
          sets: Number(ex.sets ?? 0),
          reps: String(ex.reps ?? ''),
          rest_sec: Number(ex.rest_sec ?? 60),
        }))
        .filter((ex) => ex.exercise && ex.sets > 0 && String(ex.reps ?? '').trim().length > 0)
    : [];

  if (exercises.length === 0) return null;

  return {
    date: String(parsed.date),
    day_name: typeof parsed.day_name === 'string' ? String(parsed.day_name) : undefined,
    title: String(parsed.title ?? ''),
    focus: String(parsed.focus ?? ''),
    workout_type:
      typeof parsed.workout_type === 'string' ? String(parsed.workout_type).trim() : undefined,
    focus_muscles: Array.isArray(parsed.focus_muscles)
      ? (parsed.focus_muscles as unknown[]).map((m) => String(m ?? '').trim()).filter(Boolean)
      : undefined,
    exercises,
  };
}

function buildDayPrompt(params: {
  dayIndex: number;
  sk: DaySkeleton;
  profileContext: string;
  equipment: string;
  trainingStyle: string;
  tier: TierExperience;
  tierIndex: number;
  usedExerciseNames: string[];
  previousTrainingNames: Set<string>;
}): string {
  const { min, max } = exerciseRangeForTier(params.tier);
  const dow = DAY_NAMES[params.dayIndex];
  const usedList =
    params.usedExerciseNames.length > 0
      ? params.usedExerciseNames.slice(-80).join(', ')
      : '(none yet)';
  const prevNote =
    params.previousTrainingNames.size > 0
      ? `Previous training day used: ${[...params.previousTrainingNames].slice(0, 40).join(', ')}. At least 5 exercises MUST differ from that list (use different movement patterns).`
      : '';

  return `Generate ONE workout for ${dow} (day ${params.dayIndex + 1} of 7) — date ${params.sk.date}.

Workout type (use EXACTLY this label for workout_type): "${params.sk.workoutType}"
Focus muscles: ${params.sk.focusMuscles.join(', ') || 'appropriate to the workout type'}
Intent: ${params.sk.sequencingNote}

User profile: ${params.profileContext}
Equipment access: ${params.equipment || 'Not specified'}
Typical training style: ${params.trainingStyle || 'Not specified'}
Tier: ${params.tier} (tier ${params.tierIndex + 1} of 3) — scale sets, intensity, and rest periods for this level.
Exercise count: ${min}-${max} movements.

Exercises already used earlier THIS WEEK (do NOT repeat any of these names; rotate compounds — e.g. if back squat was used, use goblet squat, leg press, or split squat next time):
${usedList}

${prevNote}

Rules:
- No exercise name may appear more than 2 times in the entire week (prefer 0-1 repeats from the list above).
- Push days: rotate chest vs shoulders vs triceps emphasis across the week.
- Pull days: rotate vertical vs horizontal pulls.
- Leg days: rotate squat vs hinge vs single-leg patterns.
- Cardio/HIIT: rotate modality (run, bike, row, jump rope, stairs) vs earlier cardio days.
- Return JSON only:
{
  "date": "${params.sk.date}",
  "day_name": "${dow}",
  "title": "short title",
  "workout_type": "${params.sk.workoutType}",
  "focus_muscles": ["..."],
  "focus": "one sentence",
  "exercises": [ { "exercise": "...", "sets": 4, "reps": "8-10", "rest_sec": 90 } ]
}`;
}

/**
 * 7 sequential AI calls (one per non-rest day) + deterministic rest days.
 */
export async function generateWeekPlanWithDailyAI(params: {
  skeleton: WeeklyPlanSkeleton;
  profileContext: string;
  equipment: string;
  trainingStyle: string;
  tierExperience: TierExperience;
  tierIndex: number;
}): Promise<{ week_start: string; split_name: string; days: ApiWorkoutDay[] }> {
  const { skeleton, profileContext, equipment, trainingStyle, tierExperience, tierIndex } = params;

  const usedNames: string[] = [];
  let previousTrainingKeys = new Set<string>();
  const days: ApiWorkoutDay[] = [];

  for (let i = 0; i < skeleton.days.length; i++) {
    const sk = skeleton.days[i];

    if (isRestLikeSkeleton(sk)) {
      const ex = buildFallbackExercisesForDay(sk, tierExperience, i);
      days.push({
        date: sk.date,
        day_name: DAY_NAMES[i],
        title: sk.workoutType,
        focus: sk.sequencingNote,
        workout_type: sk.workoutType,
        focus_muscles: sk.focusMuscles,
        exercises: ex,
      });
      continue;
    }

    const prompt = buildDayPrompt({
      dayIndex: i,
      sk,
      profileContext,
      equipment,
      trainingStyle,
      tier: tierExperience,
      tierIndex,
      usedExerciseNames: usedNames,
      previousTrainingNames: previousTrainingKeys,
    });

    let day = await callOneDayAI(prompt);

    if (!day) {
      day = {
        date: sk.date,
        day_name: DAY_NAMES[i],
        title: sk.workoutType,
        focus: sk.sequencingNote,
        workout_type: sk.workoutType,
        focus_muscles: sk.focusMuscles,
        exercises: buildFallbackExercisesForDay(sk, tierExperience, i),
      };
    }

    // Enforce skeleton metadata
    day.workout_type = sk.workoutType;
    day.focus_muscles = sk.focusMuscles.length ? sk.focusMuscles : day.focus_muscles;
    day.title = day.title?.trim() ? day.title : sk.workoutType;
    day.focus = day.focus?.trim() ? day.focus : sk.sequencingNote;
    day.day_name = DAY_NAMES[i];

    // Post-check vs previous training day: retry once if too similar
    const keys = new Set(day.exercises.map((e) => normalizeExerciseKey(e.exercise)));
    if (previousTrainingKeys.size > 0 && overlapCount(keys, previousTrainingKeys) >= 5) {
      const retry = await callOneDayAI(
        `${prompt}\n\nIMPORTANT: Your last output was too similar to the previous day. Change at least 5 exercises completely.`
      );
      if (retry && retry.exercises.length > 0) {
        retry.workout_type = sk.workoutType;
        retry.focus_muscles = sk.focusMuscles.length ? sk.focusMuscles : retry.focus_muscles;
        retry.day_name = DAY_NAMES[i];
        day = retry;
      }
    }

    for (const e of day.exercises) {
      usedNames.push(e.exercise);
    }

    previousTrainingKeys = new Set(day.exercises.map((e) => normalizeExerciseKey(e.exercise)));

    days.push(day);
  }

  assertWeekExerciseVarietyDev(days);

  return {
    week_start: skeleton.week_start,
    split_name: skeleton.split_name,
    days,
  };
}
