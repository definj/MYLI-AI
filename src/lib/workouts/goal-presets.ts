export type DayRole = 'training' | 'rest' | 'recovery' | 'cardio' | 'conditioning';

/** Maps user goal text → preset (exact 7-day structure Mon→Sun). */
export type GoalPresetKey =
  | 'muscle_gain'
  | 'fat_loss'
  | 'toning'
  | 'endurance'
  | 'body_recomp'
  | 'beginner'
  | 'general';

export type PresetDay = {
  workoutType: string;
  dayRole: DayRole;
};

/**
 * GOAL → 7-day split (Monday index 0 … Sunday 6).
 * Labels are unique per day (second Push/Legs/Upper uses a different subtitle).
 */
export const SEVEN_DAY_PRESETS: Record<GoalPresetKey, PresetDay[]> = {
  muscle_gain: [
    { workoutType: 'Push — Chest & Triceps', dayRole: 'training' },
    { workoutType: 'Pull — Back & Biceps', dayRole: 'training' },
    { workoutType: 'Legs — Quads & Glutes', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
    { workoutType: 'Push — Shoulders & Arms', dayRole: 'training' },
    { workoutType: 'Pull — Posterior & Upper Back', dayRole: 'training' },
    { workoutType: 'Legs — Hamstrings & Glutes', dayRole: 'training' },
  ],
  fat_loss: [
    { workoutType: 'Full Body A', dayRole: 'training' },
    { workoutType: 'HIIT', dayRole: 'conditioning' },
    { workoutType: 'Full Body B', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
    { workoutType: 'Cardio', dayRole: 'conditioning' },
    { workoutType: 'Full Body C', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
  ],
  toning: [
    { workoutType: 'Upper — Session A', dayRole: 'training' },
    { workoutType: 'Lower — Session A', dayRole: 'training' },
    { workoutType: 'Core + Cardio', dayRole: 'conditioning' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
    { workoutType: 'Upper — Session B', dayRole: 'training' },
    { workoutType: 'Lower — Session B', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
  ],
  endurance: [
    { workoutType: 'Run / Cardio', dayRole: 'conditioning' },
    { workoutType: 'Strength', dayRole: 'training' },
    { workoutType: 'HIIT', dayRole: 'conditioning' },
    { workoutType: 'Active Recovery', dayRole: 'recovery' },
    { workoutType: 'Cardio', dayRole: 'conditioning' },
    { workoutType: 'Long Run', dayRole: 'conditioning' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
  ],
  body_recomp: [
    { workoutType: 'Push', dayRole: 'training' },
    { workoutType: 'Pull', dayRole: 'training' },
    { workoutType: 'Legs', dayRole: 'training' },
    { workoutType: 'HIIT', dayRole: 'conditioning' },
    { workoutType: 'Upper Body', dayRole: 'training' },
    { workoutType: 'Lower Body', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
  ],
  beginner: [
    { workoutType: 'Full Body A', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
    { workoutType: 'Full Body B', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
    { workoutType: 'Full Body C', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
  ],
  general: [
    { workoutType: 'Push — Chest & Triceps', dayRole: 'training' },
    { workoutType: 'Pull — Back & Biceps', dayRole: 'training' },
    { workoutType: 'Legs — Quads & Glutes', dayRole: 'training' },
    { workoutType: 'Rest / Recovery', dayRole: 'rest' },
    { workoutType: 'Push — Shoulders & Arms', dayRole: 'training' },
    { workoutType: 'Pull — Posterior & Upper Back', dayRole: 'training' },
    { workoutType: 'Legs — Hamstrings & Glutes', dayRole: 'training' },
  ],
};

export function resolveGoalPreset(goal: string): GoalPresetKey {
  const g = (goal || '').toLowerCase();
  if (/\b(beginner|starting out|new to training|just starting)\b/.test(g)) return 'beginner';
  if (/\b(recomp|body recomp|recomposition)\b/.test(g)) return 'body_recomp';
  if (/\b(fat loss|lose fat|lose weight|weight loss|cut|shred|slim)\b/.test(g)) return 'fat_loss';
  if (/\b(endurance|marathon|stamina|aerobic)\b/.test(g)) return 'endurance';
  if (/\b(toning|tone|lean muscle)\b/.test(g)) return 'toning';
  if (/\b(muscle|mass|hypertrophy|bulk|gain size|bodybuilding)\b/.test(g)) return 'muscle_gain';
  return 'general';
}

export function countTrainingLikeDays(preset: PresetDay[]): number {
  return preset.filter((d) => d.dayRole === 'training' || d.dayRole === 'conditioning').length;
}
