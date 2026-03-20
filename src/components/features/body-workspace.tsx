'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar } from '@/hooks/use-week-calendar';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Exercise = {
  exercise: string;
  sets: number;
  reps: string;
  rest_sec: number;
};

type Tier = {
  intensity: string;
  weekly_days: number;
  focus: string;
  sample_day: Exercise[];
  week_plan?: {
    week_start: string;
    split_name: string;
    days: Array<{
      date: string;
      title: string;
      focus: string;
      exercises: Exercise[];
    }>;
  };
};

type PlanPayload = {
  tiers: Tier[];
  note: string;
};

type WorkoutLog = {
  id: string;
  date: string;
  duration_min: number | null;
  completed: boolean;
  notes: string | null;
  exercises: unknown;
};

type MealLog = {
  id: string;
  meal_type: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  ai_description: string | null;
  logged_at: string;
};

type AnalysisResponse = {
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'liquids'] as const;

export function BodyWorkspace() {
  const searchParams = useSearchParams();
  const hasAutoStartedWorkout = useRef(false);
  const hasAutoOpenedCamera = useRef(false);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);

  const [plans, setPlans] = useState<PlanPayload | null>(null);
  const [activeTier, setActiveTier] = useState<number>(2);
  const [activatedTier, setActivatedTier] = useState<number | null>(null);
  const [activeDays, setActiveDays] = useState<Record<string, { title: string; focus: string; exercises: Exercise[] }>>({});
  const [regeneratingDate, setRegeneratingDate] = useState<string | null>(null);
  const [isActivatingPlan, setIsActivatingPlan] = useState(false);

  const [dayWorkouts, setDayWorkouts] = useState<WorkoutLog[]>([]);
  const [dayMeals, setDayMeals] = useState<MealLog[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null);

  const [equipment, setEquipment] = useState('');
  const [trainingStyle, setTrainingStyle] = useState('');
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [manualActivity, setManualActivity] = useState('');
  const [manualDuration, setManualDuration] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [plannedSaving, setPlannedSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const [mealType, setMealType] = useState<string>('lunch');
  const [restaurantUrl, setRestaurantUrl] = useState('');
  const [mealFiles, setMealFiles] = useState<File[]>([]);
  const [mealSaving, setMealSaving] = useState(false);
  const [mealError, setMealError] = useState<string | null>(null);
  const [mealResult, setMealResult] = useState<AnalysisResponse | null>(null);

  const buildDots = useCallback(
    (day: { meals: number; workouts: number; tasks: { pending: number; completed: number }; calendar_events: number }) => {
      const dots: Array<{ color: string; label: string }> = [];
      if (day.workouts > 0) dots.push({ color: 'bg-blue-400', label: `${day.workouts} workouts` });
      if (day.meals > 0) dots.push({ color: 'bg-emerald-400', label: `${day.meals} meals` });
      if (day.calendar_events > 0) dots.push({ color: 'bg-violet-400', label: `${day.calendar_events} events` });
      return dots;
    },
    []
  );

  const { selectedDate, setSelectedDate, weekOffset, setWeekOffset, activityMap, refresh } = useWeekCalendar(buildDots);
  const selectedActiveDay = activeDays[selectedDate] ?? null;

  const calendarActivityMap = useMemo(() => {
    const merged = { ...activityMap };
    for (const [date, planned] of Object.entries(activeDays)) {
      const existing = merged[date]?.dots ?? [];
      merged[date] = {
        dots: [...existing, { color: 'bg-[#FF9A5C]', label: planned.title }],
      };
    }
    return merged;
  }, [activityMap, activeDays]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const startIso = `${selectedDate}T00:00:00.000Z`;
    const endIso = `${selectedDate}T23:59:59.999Z`;

    Promise.all([
      supabase
        .from('workout_logs')
        .select('id, date, duration_min, completed, notes, exercises')
        .eq('date', selectedDate)
        .order('date', { ascending: false }),
      supabase
        .from('meal_logs')
        .select('id, meal_type, calories, protein_g, carbs_g, fat_g, ai_description, logged_at')
        .gte('logged_at', startIso)
        .lte('logged_at', endIso)
        .order('logged_at', { ascending: false }),
    ]).then(([workoutsRes, mealsRes]) => {
      if (cancelled) return;
      setDayWorkouts((workoutsRes.data ?? []) as WorkoutLog[]);
      setDayMeals((mealsRes.data ?? []) as MealLog[]);
      setLoadingDay(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const generateWorkoutPlans = async () => {
    setGenerateError(null);
    setGenerateLoading(true);
    const response = await fetch('/api/workouts/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scope: 'week',
        equipment,
        training_style: trainingStyle,
        active_tier_index: activeTier,
      }),
    });
    setGenerateLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Failed to generate plan.' }));
      setGenerateError(body.error || 'Failed to generate plan.');
      return;
    }
    const data = (await response.json()) as PlanPayload;
    const defaultTierIndex = data.tiers.length - 1;
    const defaultDays = data.tiers[defaultTierIndex]?.week_plan?.days ?? [];
    const next: Record<string, { title: string; focus: string; exercises: Exercise[] }> = {};
    for (const day of defaultDays) {
      next[day.date] = { title: day.title, focus: day.focus, exercises: day.exercises };
    }
    setPlans(data);
    setActiveTier(defaultTierIndex);
    setActivatedTier(defaultTierIndex);
    setActiveDays(next);
    refresh();
  };

  const activatePlan = async () => {
    if (!plans) return;
    const tier = plans.tiers[activeTier];
    const days = tier.week_plan?.days ?? [];
    if (days.length === 0) {
      setGenerateError('This tier does not have a 7-day plan yet. Try regenerating.');
      return;
    }
    setGenerateError(null);
    setIsActivatingPlan(true);
    try {
      const response = await fetch('/api/workouts/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          intensity: tier.intensity,
          week_start: tier.week_plan?.week_start,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Failed to activate plan.' }));
        setGenerateError(body.error || 'Failed to activate plan.');
        return;
      }
      const next: Record<string, { title: string; focus: string; exercises: Exercise[] }> = {};
      for (const day of days) {
        next[day.date] = { title: day.title, focus: day.focus, exercises: day.exercises };
      }
      setActiveDays(next);
      setActivatedTier(activeTier);
    } finally {
      setIsActivatingPlan(false);
    }
  };

  const regenerateDay = async (date: string) => {
    if (!plans || activatedTier == null || activatedTier !== activeTier) {
      setGenerateError('Activate your selected plan first before regenerating days.');
      return;
    }
    setRegeneratingDate(date);
    setGenerateError(null);
    try {
      const response = await fetch('/api/workouts/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'day',
          date,
          equipment,
          training_style: trainingStyle,
          active_tier_index: activeTier,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Failed to regenerate day.' }));
        setGenerateError(body.error || 'Failed to regenerate day.');
        return;
      }
      const body = (await response.json()) as { day?: { title: string; focus: string; exercises: Exercise[] } };
      if (body.day) {
        setActiveDays((prev) => ({ ...prev, [date]: body.day! }));
      }
      refresh();
    } finally {
      setRegeneratingDate(null);
    }
  };

  const logOutsideWorkout = async () => {
    const activity = manualActivity.trim();
    if (!activity) {
      setManualError('Add at least one activity.');
      return;
    }
    const parsedDuration = manualDuration.trim() ? Number(manualDuration) : null;
    if (parsedDuration != null && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
      setManualError('Duration must be a positive number.');
      return;
    }

    setManualSaving(true);
    setManualError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setManualError('You must be signed in to log workouts.');
        return;
      }

      const exercises = activity
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => ({ exercise: entry, sets: 1, reps: 'Logged', rest_sec: 0 }));

      const { data, error } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          date: selectedDate,
          exercises,
          duration_min: parsedDuration == null ? null : Math.round(parsedDuration),
          completed: true,
          notes: manualNotes.trim() || null,
        })
        .select('id, date, duration_min, completed, notes, exercises')
        .single();

      if (error || !data) {
        setManualError(error?.message || 'Failed to save workout.');
        return;
      }

      setDayWorkouts((prev) => [data as WorkoutLog, ...prev]);
      setManualActivity('');
      setManualDuration('');
      setManualNotes('');
      refresh();
    } finally {
      setManualSaving(false);
    }
  };

  const logPlannedWorkout = async () => {
    if (!selectedActiveDay) return;
    setManualError(null);
    setPlannedSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setManualError('You must be signed in to log workouts.');
        return;
      }
      const { data, error } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          date: selectedDate,
          exercises: selectedActiveDay.exercises,
          duration_min: null,
          completed: true,
          notes: `Completed plan: ${selectedActiveDay.title}`,
        })
        .select('id, date, duration_min, completed, notes, exercises')
        .single();
      if (error || !data) {
        setManualError(error?.message || 'Failed to log planned workout.');
        return;
      }
      setDayWorkouts((prev) => [data as WorkoutLog, ...prev]);
      refresh();
    } finally {
      setPlannedSaving(false);
    }
  };

  const analyzeMeal = async () => {
    if (mealFiles.length === 0) {
      setMealError('Upload at least one meal image first.');
      return;
    }
    setMealSaving(true);
    setMealError(null);
    setMealResult(null);
    try {
      const results: AnalysisResponse[] = [];
      for (const file of mealFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('meal_type', mealType);
        if (restaurantUrl.trim()) formData.append('restaurant_url', restaurantUrl.trim());
        const response = await fetch('/api/meals/analyze', { method: 'POST', body: formData });
        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: 'Unable to analyze meal.' }));
          setMealError(body.error || 'Unable to analyze meal.');
          return;
        }
        results.push((await response.json()) as AnalysisResponse);
      }
      const combined: AnalysisResponse = results.reduce(
        (acc, r) => ({
          description: `${results.length} meal image${results.length > 1 ? 's' : ''} analyzed`,
          calories: acc.calories + r.calories,
          protein_g: acc.protein_g + r.protein_g,
          carbs_g: acc.carbs_g + r.carbs_g,
          fat_g: acc.fat_g + r.fat_g,
        }),
        { description: '', calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      );
      setMealResult(combined);
      setMealFiles([]);
      refresh();
    } finally {
      setMealSaving(false);
    }
  };

  const dayLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const handleDateSelect = (iso: string) => {
    setLoadingDay(true);
    setSelectedDate(iso);
  };

  const handlePlannerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void generateWorkoutPlans();
    }
  };

  const handleManualWorkoutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void logOutsideWorkout();
    }
  };

  const handleMealInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void analyzeMeal();
    }
  };

  const deleteWorkoutLog = async (id: string) => {
    const supabase = createClient();
    const prev = dayWorkouts;
    setDeletingWorkoutId(id);
    setDayWorkouts((current) => current.filter((workout) => workout.id !== id));
    const { error } = await supabase.from('workout_logs').delete().eq('id', id);
    setDeletingWorkoutId(null);
    if (error) {
      setDayWorkouts(prev);
      setManualError(error.message);
      return;
    }
    refresh();
  };

  const deleteMealLog = async (id: string) => {
    setDeletingMealId(id);
    const prev = dayMeals;
    setDayMeals((current) => current.filter((meal) => meal.id !== id));
    const response = await fetch(`/api/meals/${id}`, { method: 'DELETE' });
    setDeletingMealId(null);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: 'Failed to delete meal.' }));
      setDayMeals(prev);
      setMealError(payload.error || 'Failed to delete meal.');
      return;
    }
    refresh();
  };

  useEffect(() => {
    if (searchParams.get('startWorkout') !== '1' || hasAutoStartedWorkout.current) return;
    hasAutoStartedWorkout.current = true;
    if (!plans) {
      void generateWorkoutPlans();
    }
  }, [searchParams, plans]);

  useEffect(() => {
    if (searchParams.get('openCamera') !== '1' || hasAutoOpenedCamera.current) return;
    hasAutoOpenedCamera.current = true;
    mobileCameraInputRef.current?.click();
  }, [searchParams]);

  return (
    <section className="space-y-4 lg:space-y-5">
      <WeeklyCalendar
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        activityMap={calendarActivityMap}
        theme="physical"
      />

      <div id="workout-planner" className="rounded-[16px] border border-[#FF6B35]/25 bg-[#FF6B35]/8 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#FFC3A0]">Workout Planner</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Input
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            onKeyDown={handlePlannerKeyDown}
            placeholder="Equipment access"
            className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/40"
          />
          <Input
            value={trainingStyle}
            onChange={(e) => setTrainingStyle(e.target.value)}
            onKeyDown={handlePlannerKeyDown}
            placeholder="Training style"
            className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/40"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={generateWorkoutPlans}
            disabled={generateLoading}
            className="h-10 bg-gradient-to-r from-[#FF6B35] to-[#FF9A5C] text-white"
          >
            {generateLoading ? 'Generating...' : 'Generate plan tiers'}
          </Button>
          <Button
            type="button"
            onClick={activatePlan}
            disabled={!plans || isActivatingPlan}
            className="h-10 border border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            {isActivatingPlan ? 'Activating...' : 'Activate selected tier'}
          </Button>
        </div>
        {generateError && <p className="mt-2 text-xs text-red-300">{generateError}</p>}

        {plans && (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {plans.tiers.map((tier, idx) => (
              <button
                key={`${tier.intensity}-${idx}`}
                type="button"
                onClick={() => setActiveTier(idx)}
                className={`rounded-[12px] border p-3 text-left ${
                  activeTier === idx
                    ? 'border-[#FF9A5C] bg-[#FF6B35]/20'
                    : 'border-white/10 bg-black/20'
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#FFC3A0]">{tier.intensity}</p>
                <p className="mt-1 text-sm font-semibold text-white">{tier.weekly_days} days / week</p>
                <p className="mt-1 text-xs text-white/60">{tier.focus}</p>
                {activatedTier === idx && <p className="mt-2 text-[10px] text-emerald-300">Active</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedActiveDay && (
        <div className="rounded-[16px] border border-[#FF6B35]/25 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{selectedActiveDay.title}</p>
              <p className="text-xs text-white/60">{selectedActiveDay.focus}</p>
            </div>
            <Button
              type="button"
              onClick={() => regenerateDay(selectedDate)}
              disabled={regeneratingDate === selectedDate || generateLoading}
              className="h-9 border border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              {regeneratingDate === selectedDate ? 'Regenerating...' : 'Regenerate day'}
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {selectedActiveDay.exercises.length === 0 ? (
              <p className="rounded-md bg-white/5 p-3 text-sm text-white/60">Recovery day</p>
            ) : (
              selectedActiveDay.exercises.map((ex) => (
                <div key={ex.exercise} className="rounded-md border border-white/10 bg-black/25 p-3 text-sm">
                  <p className="font-medium text-white">{ex.exercise}</p>
                  <p className="text-xs text-white/55">
                    {ex.sets} x {ex.reps}
                  </p>
                </div>
              ))
            )}
          </div>
          <Button
            type="button"
            onClick={logPlannedWorkout}
            disabled={plannedSaving}
            className="mt-3 h-10 bg-white text-black"
          >
            {plannedSaving ? 'Logging...' : 'Mark planned workout complete'}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[16px] border border-[#FF6B35]/20 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">Log outside workout</p>
          <p className="mt-1 text-xs text-white/45">For {dayLabel}</p>
          <div className="mt-3 space-y-2">
            <Input
              value={manualActivity}
              onChange={(e) => setManualActivity(e.target.value)}
              onKeyDown={handleManualWorkoutKeyDown}
              placeholder="Activity names, comma separated"
              className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/40"
            />
            <Input
              value={manualDuration}
              onChange={(e) => setManualDuration(e.target.value)}
              onKeyDown={handleManualWorkoutKeyDown}
              placeholder="Duration in minutes (optional)"
              className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/40"
            />
            <Input
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              onKeyDown={handleManualWorkoutKeyDown}
              placeholder="Notes (optional)"
              className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/40"
            />
            <Button type="button" onClick={logOutsideWorkout} disabled={manualSaving} className="h-10 w-full bg-white text-black">
              {manualSaving ? 'Saving...' : 'Save workout log'}
            </Button>
            {manualError && <p className="text-xs text-red-300">{manualError}</p>}
          </div>
        </div>

        <div id="meal-logging" className="rounded-[16px] border border-[#A78BFA]/20 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#D5C7FF]">Meal Logging</p>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  className={`rounded-md px-2.5 py-1 text-xs capitalize ${
                    mealType === type ? 'bg-white text-black' : 'bg-black/30 text-white/80'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <Input
              value={restaurantUrl}
              onChange={(e) => setRestaurantUrl(e.target.value)}
              onKeyDown={handleMealInputKeyDown}
              placeholder="Restaurant URL (optional)"
              className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/40"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-black/30 text-xs text-white/80 hover:bg-black/40 sm:hidden">
                Take photo
                <input
                  ref={mobileCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files ? Array.from(e.target.files) : [];
                    if (picked.length > 0) setMealFiles((prev) => [...prev, ...picked]);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              <label className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-white/20 bg-black/30 text-xs text-white/80 hover:bg-black/40">
                Upload image{mealFiles.length > 0 ? 's' : ''}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files ? Array.from(e.target.files) : [];
                    if (picked.length > 0) setMealFiles((prev) => [...prev, ...picked]);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            <Button
              type="button"
              onClick={analyzeMeal}
              disabled={mealSaving}
              className="h-10 w-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              {mealSaving ? 'Analyzing...' : 'Analyze and log meal'}
            </Button>
            {mealError && <p className="text-xs text-red-300">{mealError}</p>}
            {mealResult && (
              <p className="text-xs text-white/75">
                Logged: {Math.round(mealResult.calories)} kcal · {Math.round(mealResult.protein_g)}p ·{' '}
                {Math.round(mealResult.carbs_g)}c · {Math.round(mealResult.fat_g)}f
              </p>
            )}
            {mealFiles.length > 0 && <p className="text-xs text-white/55">{mealFiles.length} image(s) selected</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">Workouts on {dayLabel}</p>
          <div className="mt-3 space-y-2">
            {loadingDay ? (
              <div className="h-20 animate-pulse rounded-md bg-white/5" />
            ) : dayWorkouts.length === 0 ? (
              <p className="rounded-md bg-black/25 p-3 text-sm text-white/50">No workouts logged for this day yet.</p>
            ) : (
              dayWorkouts.map((workout) => (
                <div key={workout.id} className="rounded-md border border-white/10 bg-black/25 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{workout.notes || 'Workout log'}</p>
                      <p className="text-xs text-white/55">
                        {workout.duration_min ? `${workout.duration_min} min` : 'Duration not set'} ·{' '}
                        {workout.completed ? 'Completed' : 'Open'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteWorkoutLog(workout.id)}
                      disabled={deletingWorkoutId === workout.id}
                      className="rounded-md border border-red-300/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                    >
                      {deletingWorkoutId === workout.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-semibold text-white">Meals on {dayLabel}</p>
          <div className="mt-3 grid gap-2">
            {loadingDay ? (
              <div className="h-16 animate-pulse rounded-md bg-white/5" />
            ) : dayMeals.length === 0 ? (
              <p className="rounded-md bg-black/25 p-3 text-sm text-white/50">No meals logged for this day yet.</p>
            ) : (
              dayMeals.map((meal) => (
                <div key={meal.id} className="rounded-md border border-white/10 bg-black/25 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium capitalize text-white">{meal.meal_type || 'meal'}</p>
                      <p className="text-xs text-white/55">
                        {Math.round(Number(meal.calories ?? 0))} kcal · {Math.round(Number(meal.protein_g ?? 0))}p ·{' '}
                        {Math.round(Number(meal.carbs_g ?? 0))}c · {Math.round(Number(meal.fat_g ?? 0))}f
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteMealLog(meal.id)}
                      disabled={deletingMealId === meal.id}
                      className="rounded-md border border-red-300/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                    >
                      {deletingMealId === meal.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
