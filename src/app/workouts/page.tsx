'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar } from '@/hooks/use-week-calendar';
import { createClient } from '@/lib/supabase/client';

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
  exercises: unknown;
  notes: string | null;
};

function TierCard({ tier, isActive, onSelect }: { tier: Tier; isActive: boolean; onSelect: () => void }) {
  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        isActive
          ? 'border-accent-gold bg-bg-surface/70'
          : 'border-bg-surface bg-bg-surface/40 hover:border-accent-gold/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent-muted">{tier.intensity}</p>
          <p className="mt-1 text-lg font-medium text-accent-white">{tier.weekly_days} days / week</p>
        </div>
        <Button
          type="button"
          className={isActive
            ? 'bg-accent-gold text-bg-primary hover:bg-accent-gold/90'
            : 'bg-bg-secondary text-accent-muted hover:text-accent-white'}
          onClick={onSelect}
        >
          {isActive ? 'Active' : 'Select'}
        </Button>
      </div>
      <p className="mt-3 text-sm text-accent-muted">{tier.focus}</p>

      {tier.sample_day && tier.sample_day.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="font-mono text-xs uppercase tracking-widest text-accent-muted">Sample Day</p>
          {tier.sample_day.map((ex) => (
            <div key={ex.exercise} className="flex items-center justify-between rounded-md bg-bg-secondary px-3 py-2 text-sm">
              <span className="text-accent-white">{ex.exercise}</span>
              <span className="font-mono text-xs text-accent-muted">
                {ex.sets} x {ex.reps} &middot; {ex.rest_sec}s rest
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkoutsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [plans, setPlans] = useState<PlanPayload | null>(null);
  const [activeTier, setActiveTier] = useState<number>(2);
  const [error, setError] = useState<string | null>(null);
  const [equipment, setEquipment] = useState('');
  const [trainingStyle, setTrainingStyle] = useState('');
  const [regeneratingDate, setRegeneratingDate] = useState<string | null>(null);

  const [dayWorkouts, setDayWorkouts] = useState<WorkoutLog[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  const buildDots = useCallback(
    (day: { meals: number; workouts: number; tasks: { pending: number; completed: number } }) => {
      const dots: Array<{ color: string; label: string }> = [];
      if (day.workouts > 0) dots.push({ color: 'bg-blue-400', label: `${day.workouts} workout${day.workouts > 1 ? 's' : ''}` });
      return dots;
    },
    []
  );

  const { selectedDate, setSelectedDate, weekOffset, setWeekOffset, activityMap } =
    useWeekCalendar(buildDots);

  useEffect(() => {
    let cancelled = false;
    setDayLoading(true);
    const supabase = createClient();

    supabase
      .from('workout_logs')
      .select('id, date, duration_min, completed, exercises, notes')
      .eq('date', selectedDate)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setDayWorkouts((data ?? []) as WorkoutLog[]);
          setDayLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [selectedDate]);

  const generatePlans = async () => {
    setError(null);
    setIsLoading(true);
    const response = await fetch('/api/workouts/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scope: 'week',
        equipment,
        training_style: trainingStyle,
      }),
    });
    setIsLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Failed to generate plans.' }));
      setError(body.error || 'Failed to generate plans.');
      return;
    }
    const data = (await response.json()) as PlanPayload;
    setPlans(data);
    setActiveTier(data.tiers.length - 1);
  };

  const regenerateDay = async (date: string) => {
    if (!plans) return;
    setError(null);
    setRegeneratingDate(date);
    try {
      const response = await fetch('/api/workouts/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'day',
          date,
          equipment,
          training_style: trainingStyle,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Failed to regenerate day.' }));
        setError(body.error || 'Failed to regenerate day.');
        return;
      }

      const result = (await response.json()) as { week_plan?: Tier['week_plan'] };
      if (!result.week_plan) return;

      setPlans((prev) => {
        if (!prev) return prev;
        const tiers = prev.tiers.map((tier, idx) =>
          idx === activeTier ? { ...tier, week_plan: result.week_plan } : tier
        );
        return { ...prev, tiers };
      });
    } finally {
      setRegeneratingDate(null);
    }
  };

  return (
    <FeatureShell
      eyebrow="Workouts"
      title="Workout Plans"
      description="Generate AI-personalized workout plan tiers based on your physical profile and goals."
    >
      <WeeklyCalendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        activityMap={activityMap}
      />

      <div className="space-y-4">
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs text-accent-muted mb-1">What equipment do you have access to?</p>
              <Input
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="e.g. full gym, dumbbells only, hotel gym, bands, pull-up bar..."
                className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
              />
            </div>
            <div>
              <p className="text-xs text-accent-muted mb-1">How do you typically train?</p>
              <Input
                value={trainingStyle}
                onChange={(e) => setTrainingStyle(e.target.value)}
                placeholder="e.g. 45 min sessions, prefer machines, minimal cardio, like supersets..."
                className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
              />
            </div>
          </div>
          <Button
            type="button"
            className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
            onClick={generatePlans}
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : plans ? 'Regenerate Plans' : 'Generate 3-Tier Plan'}
          </Button>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          {plans?.note && (
            <p className="mt-3 text-sm text-accent-muted">{plans.note}</p>
          )}
        </div>

        {plans && (
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.tiers.map((tier, idx) => (
              <TierCard
                key={tier.intensity}
                tier={tier}
                isActive={idx === activeTier}
                onSelect={() => setActiveTier(idx)}
              />
            ))}
          </div>
        )}

        {plans?.tiers?.[activeTier]?.week_plan?.days && (
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-accent-white">This week’s split</p>
                <p className="text-xs text-accent-muted">{plans.tiers[activeTier].week_plan?.split_name}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-xs text-accent-muted">
                  Week of {plans.tiers[activeTier].week_plan?.week_start}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="bg-bg-secondary text-accent-muted hover:text-accent-white text-xs h-8 px-3"
                  onClick={generatePlans}
                  disabled={isLoading}
                >
                  {isLoading ? 'Regenerating...' : '↺ Regenerate Week'}
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {plans.tiers[activeTier].week_plan!.days.map((day) => {
                const isRestDay = /rest|recovery/i.test(day.title);
                const isRegenerating = regeneratingDate === day.date;
                return (
                <div key={day.date} className="rounded-lg border border-bg-surface bg-bg-secondary p-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/workouts/day/${day.date}`} className="text-sm font-medium text-accent-white hover:underline">
                      {day.title}
                    </Link>
                    <p className="text-xs font-mono text-accent-muted">{day.date}</p>
                  </div>
                  <p className="mt-1 text-xs text-accent-muted">{day.focus}</p>
                  <div className="mt-3 space-y-2">
                    {day.exercises.slice(0, 5).map((ex) => (
                      <div key={ex.exercise} className="flex items-center justify-between rounded-md bg-bg-primary px-3 py-2 text-xs">
                        <span className="text-accent-white">{ex.exercise}</span>
                        <span className="font-mono text-accent-muted">{ex.sets}x{ex.reps}</span>
                      </div>
                    ))}
                    {day.exercises.length > 5 && (
                      <p className="text-xs text-accent-muted">+ {day.exercises.length - 5} more</p>
                    )}
                    {isRestDay && day.exercises.length === 0 && (
                      <p className="text-xs text-accent-muted italic">Active recovery day — no lifting</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => regenerateDay(day.date)}
                    disabled={isRegenerating || isLoading}
                    className="mt-3 w-full rounded-md bg-bg-primary px-3 py-1.5 text-xs text-accent-muted hover:text-accent-white transition-colors disabled:opacity-40"
                  >
                    {isRegenerating ? 'Regenerating...' : '↺ Regenerate this day'}
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Workout logs for selected day */}
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
        <p className="text-sm font-medium text-accent-white mb-3">
          Workouts on {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        {dayLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-bg-secondary" />
            ))}
          </div>
        ) : dayWorkouts.length === 0 ? (
          <p className="text-sm text-accent-muted">No workouts logged on this day.</p>
        ) : (
          <div className="space-y-2">
            {dayWorkouts.map((w) => {
              const exerciseCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
              return (
                <div key={w.id} className="flex items-center justify-between rounded-md bg-bg-secondary px-4 py-3 text-sm">
                  <div>
                    <p className="text-accent-white">
                      {w.duration_min ? `${w.duration_min} min` : 'Session'}
                      {exerciseCount > 0 && ` — ${exerciseCount} exercise${exerciseCount > 1 ? 's' : ''}`}
                    </p>
                    {w.notes && <p className="mt-0.5 text-xs text-accent-muted line-clamp-1">{w.notes}</p>}
                  </div>
                  <span className={`font-mono text-xs uppercase ${w.completed ? 'text-success' : 'text-amber-400'}`}>
                    {w.completed ? 'Done' : 'Incomplete'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FeatureShell>
  );
}
