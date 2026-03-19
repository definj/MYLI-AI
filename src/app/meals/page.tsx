'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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
  const [restaurantUrl, setRestaurantUrl] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [dayMeals, setDayMeals] = useState<MealLog[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!cameraActive || !videoRef.current) return;
    let mounted = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        if (!mounted || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (mounted) setError('Camera access denied or unavailable.');
      });
    return () => {
      mounted = false;
      stopCamera();
    };
  }, [cameraActive, stopCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setFile(new File([blob], 'meal-capture.jpg', { type: 'image/jpeg' }));
        setSaved(false);
        stopCamera();
      }
    }, 'image/jpeg', 0.92);
  }, [stopCamera]);

  const analyzeMeal = async () => {
    if (!file) return;
    setError(null);
    setSaved(false);
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meal_type', mealType);
    if (restaurantUrl.trim()) formData.append('restaurant_url', restaurantUrl.trim());
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
    if (cameraActive) stopCamera();
  };

  const deleteMeal = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/meals/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDayMeals((prev) => prev.filter((m) => m.id !== id));
        refresh();
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <FeatureShell
      eyebrow="Meals"
      title="Meal Logging"
      description="Capture or upload a photo of your meal and let AI analyze the macros. Add a restaurant link for clearer data. Results are saved to your nutrition log."
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

          <div>
            <label className="mb-1 block text-xs text-accent-muted">
              Optional: Restaurant or menu link (for clearer nutrition data)
            </label>
            <Input
              type="url"
              placeholder="https://..."
              value={restaurantUrl}
              onChange={(e) => setRestaurantUrl(e.target.value)}
              className="h-10 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
            />
          </div>

          {!cameraActive ? (
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-md border border-bg-surface bg-bg-secondary px-4 py-2 text-sm text-accent-white hover:bg-bg-primary">
                <span className="mr-2">Upload image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setSaved(false);
                  }}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="border-bg-surface text-accent-white"
                onClick={() => { setError(null); setCameraActive(true); }}
              >
                Take a picture
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative aspect-video max-h-80 w-full overflow-hidden rounded-lg border border-bg-surface bg-bg-primary">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90" onClick={capturePhoto}>
                  Capture photo
                </Button>
                <Button type="button" variant="outline" className="border-bg-surface text-accent-muted" onClick={stopCamera}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {preview && !cameraActive && (
            <div className="flex max-h-80 w-full justify-center rounded-lg border border-bg-surface bg-bg-secondary p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Meal preview"
                className="max-h-72 w-full object-contain"
              />
            </div>
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
              <div key={meal.id} className="flex items-center justify-between gap-2 rounded-md bg-bg-secondary px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/meals/${meal.id}`} className="font-medium text-accent-white capitalize hover:underline truncate">
                      {meal.meal_type ?? 'Meal'}
                    </Link>
                  </div>
                  {meal.ai_description && (
                    <p className="mt-0.5 text-xs text-accent-muted line-clamp-1">{meal.ai_description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-accent-muted">
                    <span className="text-accent-gold">{meal.calories ?? 0} cal</span>
                    {' '}{meal.protein_g ?? 0}p {meal.carbs_g ?? 0}c {meal.fat_g ?? 0}f
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-danger hover:bg-danger/10 hover:text-danger"
                    onClick={() => deleteMeal(meal.id)}
                    disabled={deletingId === meal.id}
                  >
                    {deletingId === meal.id ? '…' : 'Delete'}
                  </Button>
                  <Link href={`/meals/${meal.id}`}>
                    <Button type="button" variant="outline" size="sm" className="h-8 border-bg-surface text-accent-muted hover:text-accent-white">
                      View / Replace
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FeatureShell>
  );
}
