/**
 * Deterministic weekly skeleton: assigns a UNIQUE workoutType per training day
 * (and distinct recovery/cardio labels) so AI or fallbacks cannot collapse into clones.
 */

import {
  countTrainingLikeDays,
  resolveGoalPreset,
  SEVEN_DAY_PRESETS,
  type DayRole,
  type GoalPresetKey,
} from './goal-presets';

export type GoalCategory =
  | 'fat_loss'
  | 'endurance'
  | 'muscle'
  | 'toning'
  | 'athletic'
  | 'beginner'
  | 'general';

export type TierExperience = 'beginner' | 'intermediate' | 'advanced';

export type UserWorkoutProfile = {
  goal: string;
  goalCategory: GoalCategory;
  /** Resolved training days per week (3–6) */
  weeklyTrainingDays: number;
  /** 0 = tier 1, 1 = tier 2, 2 = tier 3 */
  tierIndex: number;
  tier: TierExperience;
  equipment?: string;
  trainingStyle?: string;
  /** Parsed from free text (equipment / training style / goal) */
  targetAreas: string[];
};

export type { DayRole };

export type DaySkeleton = {
  /** YYYY-MM-DD */
  date: string;
  workoutType: string;
  focusMuscles: string[];
  dayRole: DayRole;
  /** Sequencing / science note for the model */
  sequencingNote: string;
};

export type WeeklyPlanSkeleton = {
  week_start: string;
  split_name: string;
  goal_category: GoalCategory;
  /** Which 7-day preset was applied */
  goal_preset?: GoalPresetKey;
  days: DaySkeleton[];
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function addDaysDateOnly(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function categorizeGoal(goal: string): GoalCategory {
  const g = (goal || '').toLowerCase();
  if (/\b(beginner|starting out|new to training|just starting)\b/.test(g)) return 'beginner';
  if (/\b(fat loss|lose fat|lose weight|weight loss|cut|shred|slim)\b/.test(g)) return 'fat_loss';
  if (/\b(endurance|cardio|marathon|run|aerobic|stamina)\b/.test(g)) return 'endurance';
  if (/\b(muscle|mass|hypertrophy|bulk|gain size|bodybuilding)\b/.test(g)) return 'muscle';
  if (/\b(toning|tone|recomp|recomposition|lean muscle)\b/.test(g)) return 'toning';
  if (/\b(athletic|athlete|performance|sport|power|explosive)\b/.test(g)) return 'athletic';
  return 'general';
}

export function extractTargetAreas(...texts: string[]): string[] {
  const blob = texts.join(' ').toLowerCase();
  const keys = [
    'glutes',
    'core',
    'upper body',
    'lower body',
    'chest',
    'back',
    'shoulders',
    'arms',
    'legs',
    'hamstrings',
    'quads',
  ];
  return keys.filter((k) => blob.includes(k));
}

export function tierExperienceForTierIndex(tierIndex: number): TierExperience {
  if (tierIndex <= 0) return 'beginner';
  if (tierIndex === 1) return 'intermediate';
  return 'advanced';
}

function noteForAreas(areas: string[]): string {
  if (!areas.length) return 'Balance volume across the whole body.';
  return `Emphasize quality work for: ${areas.join(', ')} while keeping the program balanced.`;
}

function focusForType(wt: string, areas: string[]): string[] {
  const base: string[] = [];
  if (/push|chest|shoulder|tricep/i.test(wt)) {
    base.push('chest', 'shoulders', 'triceps');
  }
  if (/pull|back|bicep/i.test(wt)) {
    base.push('back', 'biceps');
  }
  if (/leg|glute|lower|squat|hinge|posterior/i.test(wt)) {
    base.push('quads', 'hamstrings', 'glutes');
  }
  if (/upper/i.test(wt)) base.push('chest', 'back', 'shoulders', 'arms');
  if (/full body|metabolic|circuit/i.test(wt)) base.push('full body');
  if (/core|conditioning|hiit|cardio|zone|mobility|recovery|energy/i.test(wt)) {
    base.push('core', 'conditioning');
  }
  if (/power|plyo|speed|agility/i.test(wt)) base.push('hips', 'core', 'coordination');
  for (const ar of areas) {
    if (!base.includes(ar)) base.push(ar);
  }
  if (base.length === 0) return areas.length ? [...areas] : ['full body'];
  return [...new Set(base)];
}

/**
 * Main entry: 7 days from GOAL → fixed split (goal-presets), unique workoutType per day.
 */
export function weeklyPlanBuilder(
  weekStart: string,
  profile: UserWorkoutProfile
): WeeklyPlanSkeleton {
  const presetKey = resolveGoalPreset(profile.goal);
  const preset = SEVEN_DAY_PRESETS[presetKey];
  const days: DaySkeleton[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDaysDateOnly(weekStart, i);
    const dow = DAY_NAMES[i];
    const slot = preset[i];
    const workoutType = slot.workoutType;
    const dayRole = slot.dayRole;
    const focusMuscles = focusForType(workoutType, profile.targetAreas);
    const sequencingNote = `${dow}: ${workoutType}. ${noteForAreas(profile.targetAreas)} Each day is generated independently — do not repeat exercises from earlier in the week.`;

    days.push({
      date,
      workoutType,
      focusMuscles,
      dayRole,
      sequencingNote,
    });
  }

  const trainingCount = countTrainingLikeDays(preset);
  const splitName = `${presetKey} · ${trainingCount} training-like days · ${profile.tier}`;

  return {
    week_start: weekStart,
    split_name: splitName,
    goal_category: profile.goalCategory,
    goal_preset: presetKey,
    days,
  };
}

export function buildUserWorkoutProfile(params: {
  goal: string;
  tierIndex: number;
  /** Ignored — weekly volume comes from the 7-day goal preset */
  tierWeeklyDays?: number;
  equipment?: string;
  trainingStyle?: string;
}): UserWorkoutProfile {
  const goalCategory = categorizeGoal(params.goal);
  const targetAreas = extractTargetAreas(params.goal, params.equipment ?? '', params.trainingStyle ?? '');
  const presetKey = resolveGoalPreset(params.goal);
  const weeklyTrainingDays = countTrainingLikeDays(SEVEN_DAY_PRESETS[presetKey]);
  return {
    goal: params.goal,
    goalCategory,
    weeklyTrainingDays,
    tierIndex: params.tierIndex,
    tier: tierExperienceForTierIndex(params.tierIndex),
    equipment: params.equipment,
    trainingStyle: params.trainingStyle,
    targetAreas,
  };
}

/** Dev assertion: not all training days share one workout type */
export function assertWeeklyWorkoutTypesVary(workoutTypes: string[]): void {
  if (process.env.NODE_ENV !== 'development') return;
  const trainingLike = workoutTypes.filter((w) => !/rest|recovery/i.test(w));
  const unique = new Set(trainingLike);
  if (trainingLike.length > 1 && unique.size <= 1) {
    throw new Error(
      `[workout] Dev check failed: all training days share the same workoutType: ${[...unique].join(', ')}`
    );
  }
}

export function skeletonToPromptBlock(skeleton: WeeklyPlanSkeleton): string {
  return JSON.stringify(
    skeleton.days.map((d) => ({
      date: d.date,
      workout_type: d.workoutType,
      focus_muscles: d.focusMuscles,
      day_role: d.dayRole,
      sequencing: d.sequencingNote,
    })),
    null,
    2
  );
}

export type ExerciseRow = {
  exercise: string;
  sets: number;
  reps: string;
  rest_sec: number;
};

export type GeneratedWorkoutDay = {
  date: string;
  title: string;
  focus: string;
  workout_type: string;
  focus_muscles: string[];
  exercises: ExerciseRow[];
};

function setsForTier(tier: TierExperience): number {
  if (tier === 'beginner') return 3;
  if (tier === 'intermediate') return 4;
  return 4;
}

function recoveryExercises(): ExerciseRow[] {
  return [
    { exercise: 'Easy outdoor walk', sets: 1, reps: '30-45 min', rest_sec: 0 },
    { exercise: 'Breathing & mobility flow', sets: 1, reps: '10-15 min', rest_sec: 0 },
  ];
}

/** Deterministic exercises per skeleton day — always different across types */
function variationBit(workoutType: string, date: string): boolean {
  const s = `${workoutType}|${date}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2 === 1;
}

export function buildFallbackExercisesForDay(
  skeleton: DaySkeleton,
  tier: TierExperience,
  dayIndexInWeek: number
): ExerciseRow[] {
  const s = setsForTier(tier);
  const r = tier === 'beginner' ? '8-12' : tier === 'intermediate' ? '6-12' : '5-10';
  const rest = tier === 'beginner' ? 75 : 90;
  /** Vary templates by date + label so two similar sessions never clone */
  const alt = variationBit(skeleton.workoutType + String(dayIndexInWeek), skeleton.date);

  if (skeleton.dayRole === 'rest' || skeleton.dayRole === 'recovery') {
    if (/Rest \/ Recovery|complete rest/i.test(skeleton.workoutType)) {
      return [{ exercise: 'Rest or light walking', sets: 1, reps: 'as needed', rest_sec: 0 }];
    }
    return recoveryExercises();
  }

  const wt = skeleton.workoutType;

  if (/HIIT|Metabolic Circuit|Conditioning Circuit|Athletic Conditioning/i.test(wt)) {
    return [
      { exercise: 'Bike or row warm-up', sets: 1, reps: '8-10 min easy', rest_sec: 0 },
      { exercise: 'Kettlebell swing intervals', sets: 6, reps: '30 sec on / 45 sec off', rest_sec: 45 },
      { exercise: 'Burpee or slam ball intervals', sets: 5, reps: '30 sec on / 60 sec off', rest_sec: 60 },
      { exercise: 'Battle rope waves', sets: 4, reps: '40 sec', rest_sec: 60 },
      { exercise: 'Farmer carry', sets: 3, reps: '40 m', rest_sec: 90 },
      { exercise: 'Core plank circuit', sets: 3, reps: '45 sec each', rest_sec: 45 },
    ];
  }

  if (/Zone 2|Steady-State|Cardio/i.test(wt)) {
    return [
      { exercise: 'Zone 2 bike or incline walk', sets: 1, reps: '35-50 min', rest_sec: 0 },
      { exercise: 'Light core & posture drills', sets: 2, reps: '12-15', rest_sec: 45 },
    ];
  }

  if (/Push/i.test(wt) && !/Pull/i.test(wt)) {
    return [
      {
        exercise: alt ? 'Barbell bench press' : 'Dumbbell bench press',
        sets: s,
        reps: r,
        rest_sec: rest,
      },
      {
        exercise: alt ? 'Incline DB press' : 'Weighted push-up',
        sets: s - 1,
        reps: r,
        rest_sec: rest,
      },
      {
        exercise: alt ? 'Standing overhead press' : 'Landmine press',
        sets: s - 1,
        reps: r,
        rest_sec: rest,
      },
      { exercise: alt ? 'Triceps pushdown' : 'Overhead triceps extension', sets: 3, reps: '10-15', rest_sec: 60 },
      { exercise: alt ? 'Lateral raise' : 'Rear-delt fly', sets: 3, reps: '12-15', rest_sec: 45 },
    ];
  }

  if (/Pull/i.test(wt) && !/Push/i.test(wt)) {
    return [
      {
        exercise: alt ? 'Conventional deadlift' : 'Trap-bar deadlift',
        sets: s,
        reps: r,
        rest_sec: rest + 15,
      },
      {
        exercise: alt ? 'Barbell row' : 'One-arm dumbbell row',
        sets: s,
        reps: r,
        rest_sec: rest,
      },
      {
        exercise: alt ? 'Pull-up or lat pulldown' : 'Chest-supported row',
        sets: s - 1,
        reps: r,
        rest_sec: rest,
      },
      { exercise: alt ? 'Face pull' : 'Reverse fly', sets: 3, reps: '12-15', rest_sec: 60 },
      { exercise: alt ? 'Hammer curl' : 'Incline curl', sets: 3, reps: '10-12', rest_sec: 45 },
    ];
  }

  if (/Legs|Lower|Squat|Hinge|Glute|Posterior/i.test(wt)) {
    return [
      {
        exercise: alt ? 'Back squat' : 'Front squat',
        sets: s,
        reps: r,
        rest_sec: rest + 15,
      },
      {
        exercise: alt ? 'Romanian deadlift' : 'Good morning',
        sets: s - 1,
        reps: r,
        rest_sec: rest,
      },
      {
        exercise: alt ? 'Bulgarian split squat' : 'Walking lunge',
        sets: 3,
        reps: '8-12 each',
        rest_sec: 75,
      },
      { exercise: alt ? 'Leg curl' : 'Nordic curl (assisted)', sets: 3, reps: '10-15', rest_sec: 60 },
      { exercise: alt ? 'Standing calf raise' : 'Seated calf raise', sets: 3, reps: '12-15', rest_sec: 45 },
    ];
  }

  if (/Upper/i.test(wt)) {
    return [
      { exercise: alt ? 'Flat bench press' : 'Incline bench press', sets: s, reps: r, rest_sec: rest },
      { exercise: alt ? 'Chest-supported row' : 'Cable row', sets: s, reps: r, rest_sec: rest },
      { exercise: alt ? 'Single-arm Arnold press' : 'Landmine press', sets: 3, reps: '8-12 each', rest_sec: 75 },
      { exercise: alt ? 'Lat pulldown' : 'Straight-arm pulldown', sets: 3, reps: r, rest_sec: 60 },
      { exercise: alt ? 'Superset: curl + pressdown' : 'Superset: hammer curl + OH ext', sets: 3, reps: '12-15', rest_sec: 60 },
    ];
  }

  if (/Full Body|Metabolic/i.test(wt)) {
    return [
      { exercise: alt ? 'Goblet squat' : 'Trap-bar deadlift', sets: s, reps: r, rest_sec: rest },
      { exercise: alt ? 'Push-up variation' : 'DB floor press', sets: s - 1, reps: r, rest_sec: rest },
      { exercise: alt ? 'Inverted row' : 'Cable row', sets: s - 1, reps: r, rest_sec: rest },
      { exercise: alt ? 'Kettlebell swing' : 'RDL', sets: s - 1, reps: r, rest_sec: rest },
      { exercise: alt ? 'Farmer carry' : 'Suitcase carry', sets: 3, reps: '30-40 m', rest_sec: 90 },
    ];
  }

  if (/Power|Plyometric|Speed|Agility/i.test(wt)) {
    return [
      { exercise: 'Jump prep & landing mechanics', sets: 3, reps: '5', rest_sec: 120 },
      { exercise: 'Box jump or broad jump', sets: 5, reps: '3', rest_sec: 120 },
      { exercise: 'Med ball throw', sets: 4, reps: '5', rest_sec: 90 },
      { exercise: 'Sprint or sled push', sets: 6, reps: '20-30 m', rest_sec: 120 },
      { exercise: 'Core anti-rotation', sets: 3, reps: '8-10', rest_sec: 60 },
    ];
  }

  if (/Strength|Max/i.test(wt)) {
    return [
      { exercise: 'Primary squat or bench (heavy)', sets: 4, reps: '3-6', rest_sec: 180 },
      { exercise: 'Secondary compound', sets: 4, reps: '5-8', rest_sec: 150 },
      { exercise: 'Accessory lift', sets: 3, reps: '8-10', rest_sec: 90 },
      { exercise: 'Single-leg stability', sets: 3, reps: '8 each', rest_sec: 75 },
    ];
  }

  // Default: full-body rotation unique vs other defaults
  return [
    { exercise: 'Squat pattern', sets: s, reps: r, rest_sec: rest },
    { exercise: 'Hinge pattern', sets: s - 1, reps: r, rest_sec: rest },
    { exercise: 'Horizontal push', sets: s - 1, reps: r, rest_sec: rest },
    { exercise: 'Horizontal pull', sets: s - 1, reps: r, rest_sec: rest },
    { exercise: 'Core carry or plank', sets: 3, reps: '30-45 sec', rest_sec: 60 },
  ];
}

export function buildWeekPlanFromSkeleton(skeleton: WeeklyPlanSkeleton, tier: TierExperience): {
  week_start: string;
  split_name: string;
  days: GeneratedWorkoutDay[];
} {
  const days: GeneratedWorkoutDay[] = skeleton.days.map((sk, i) => ({
    date: sk.date,
    title: sk.workoutType,
    focus: sk.sequencingNote,
    workout_type: sk.workoutType,
    focus_muscles: sk.focusMuscles,
    exercises: buildFallbackExercisesForDay(sk, tier, i),
  }));

  return {
    week_start: skeleton.week_start,
    split_name: skeleton.split_name,
    days,
  };
}

/** Fingerprint of a day's strength prescription (training days only) */
function exerciseFingerprint(exercises: ExerciseRow[]): string {
  return exercises
    .map((e) => e.exercise.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join('|');
}

export function validateUniqueDailyProgramming(days: GeneratedWorkoutDay[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const training = days.filter((d) => !/rest|recovery/i.test(d.workout_type) && d.exercises.length > 0);

  const types = training.map((d) => d.workout_type.trim());
  if (types.length > 1 && new Set(types).size === 1) {
    errors.push('All training days share the same workout_type.');
  }

  const prints = training.map((d) => exerciseFingerprint(d.exercises));
  for (let i = 0; i < training.length; i++) {
    for (let j = i + 1; j < training.length; j++) {
      if (prints[i] === prints[j] && prints[i].length > 0) {
        errors.push(`Duplicate exercise lists on ${training[i].date} and ${training[j].date}.`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function enrichDaysWithSkeleton(
  days: GeneratedWorkoutDay[],
  skeleton: WeeklyPlanSkeleton
): GeneratedWorkoutDay[] {
  const byDate = new Map(skeleton.days.map((d) => [d.date, d]));
  return days.map((d) => {
    const sk = byDate.get(d.date);
    if (!sk) return d;
    return {
      ...d,
      workout_type: sk.workoutType,
      focus_muscles: sk.focusMuscles.length ? sk.focusMuscles : d.focus_muscles,
      title: d.title?.trim() ? d.title : sk.workoutType,
      focus: d.focus?.trim() ? d.focus : sk.sequencingNote,
    };
  });
}
