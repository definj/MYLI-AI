'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar } from '@/hooks/use-week-calendar';
import { createClient } from '@/lib/supabase/client';

type AnalysisResponse = {
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ingredients?: string[];
  confidence?: number;
  warning?: string;
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

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export default function MealsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mealType, setMealType] = useState<string>('lunch');
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [dayMeals, setDayMeals] = useState<MealLog[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const buildDots = useCallback(
    (day: { meals: number; workouts: number; tasks: { pending: number; completed: number } }) => {
      const dots: Array<{ color: string; label: string }> = [];
      if (day.meals > 0) dots.push({ color: 'bg-emerald-400', label: `${day.meals} meal${day.meals > 1 ? 's' : ''}` });
      return dots;
    },
    []
  );

  const { selectedDate, setSelectedDate, weekOffset, setWeekOffset, activityMap, refresh } =
    useWeekCalendar(buildDots);

  useEffect(() => {
    let cancelled = false;
    setDayLoading(true);
    const supabase = createClient();
    const startIso = `${selectedDate}T00:00:00.000Z`;
    const endIso = `${selectedDate}T23:59:59.999Z`;

    supabase
      .from('meal_logs')
      .select('id, meal_type, calories, protein_g, carbs_g, fat_g, ai_description, logged_at')
      .gte('logged_at', startIso)
      .lte('logged_at', endIso)
      .order('logged_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setDayMeals((data ?? []) as MealLog[]);
          setDayLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [selectedDate, saved]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const analyzeMeal = async () => {
    if (!file) return;
    setError(null);
    setSaved(false);
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meal_type', mealType);
    const response = await fetch('/api/meals/analyze', { method: 'POST', body: formData });
    setIsLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Unable to analyze meal.' }));
      setError(body.error || 'Unable to analyze meal.');
      return;
    }
    const body = (await response.json()) as AnalysisResponse;
    setAnalysis(body);
    setSaved(true);
    refresh();
  };

  const reset = () => {
    setAnalysis(null);
    setFile(null);
    setSaved(false);
    setError(null);
  };

  return (
    <FeatureShell
      eyebrow="Meals"
      title="Meal Logging"
      description="Capture a photo of your meal and let AI analyze the macros. Results are automatically saved to your nutrition log."
    >
      <WeeklyCalendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        activityMap={activityMap}
      />

      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <div className="space-y-4">
          <div className="flex gap-2">
            {MEAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMealType(type)}
                className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                  mealType === type
                    ? 'bg-accent-gold text-bg-primary'
                    : 'bg-bg-secondary text-accent-muted hover:text-accent-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSaved(false); }}
            className="h-12 bg-bg-secondary border-none text-accent-white file:text-accent-white"
          />
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Meal preview" className="max-h-80 w-full rounded-lg border border-bg-surface object-cover" />
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
              onClick={analyzeMeal}
              disabled={!file || isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Analyze & Log Meal'}
            </Button>
            <Button type="button" variant="outline" className="border-bg-surface text-accent-muted hover:text-accent-white" onClick={reset}>
              Reset
            </Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {analysis && (
            <div className="space-y-4 rounded-lg border border-bg-surface bg-bg-secondary p-4">
              <p className="text-sm text-accent-muted">{analysis.description}</p>
              {analysis.warning && (
                <p className="text-xs text-warning">{analysis.warning}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                <div className="rounded-md bg-bg-primary p-3 text-center">
                  <p className="text-xs text-accent-muted">Calories</p>
                  <p className="mt-1 font-display text-xl text-accent-gold">{analysis.calories}</p>
                </div>
                <div className="rounded-md bg-bg-primary p-3 text-center">
                  <p className="text-xs text-accent-muted">Protein</p>
                  <p className="mt-1 font-display text-xl">{analysis.protein_g}g</p>
                </div>
                <div className="rounded-md bg-bg-primary p-3 text-center">
                  <p className="text-xs text-accent-muted">Carbs</p>
                  <p className="mt-1 font-display text-xl">{analysis.carbs_g}g</p>
                </div>
                <div className="rounded-md bg-bg-primary p-3 text-center">
                  <p className="text-xs text-accent-muted">Fat</p>
                  <p className="mt-1 font-display text-xl">{analysis.fat_g}g</p>
                </div>
                <div className="rounded-md bg-bg-primary p-3 text-center">
                  <p className="text-xs text-accent-muted">Fiber</p>
                  <p className="mt-1 font-display text-xl">{analysis.fiber_g}g</p>
                </div>
              </div>
              {analysis.ingredients && analysis.ingredients.length > 0 && (
                <div>
                  <p className="text-xs text-accent-muted mb-2 font-mono uppercase tracking-widest">Detected Ingredients</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.ingredients.map((item) => (
                      <span key={item} className="rounded-md bg-bg-primary px-2 py-1 text-xs text-accent-white">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.confidence != null && (
                <p className="text-xs text-accent-muted">
                  AI confidence: {Math.round(analysis.confidence * 100)}%
                </p>
              )}
              {saved && (
                <p className="text-xs text-success">Meal saved to your nutrition log.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Meal history for selected day */}
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
        <p className="text-sm font-medium text-accent-white mb-3">
          Meals on {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        {dayLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-bg-secondary" />
            ))}
          </div>
        ) : dayMeals.length === 0 ? (
          <p className="text-sm text-accent-muted">No meals logged on this day.</p>
        ) : (
          <div className="space-y-2">
            {dayMeals.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between rounded-md bg-bg-secondary px-4 py-3 text-sm">
                <div>
                  <p className="text-accent-white capitalize">{meal.meal_type ?? 'Meal'}</p>
                  {meal.ai_description && (
                    <p className="mt-0.5 text-xs text-accent-muted line-clamp-1">{meal.ai_description}</p>
                  )}
                </div>
                <div className="flex gap-3 text-xs font-mono text-accent-muted">
                  <span className="text-accent-gold">{meal.calories ?? 0} cal</span>
                  <span>{meal.protein_g ?? 0}p</span>
                  <span>{meal.carbs_g ?? 0}c</span>
                  <span>{meal.fat_g ?? 0}f</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FeatureShell>
  );
}
