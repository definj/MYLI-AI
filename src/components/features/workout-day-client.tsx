'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Exercise = {
  exercise: string;
  sets: number;
  reps: string;
  rest_sec: number;
};

type WorkoutDay = {
  date: string;
  title: string;
  focus: string;
  exercises: Exercise[];
};

export function WorkoutDayClient({
  date,
  splitName,
  day,
}: {
  date: string;
  splitName: string;
  day: WorkoutDay;
}) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [equipment, setEquipment] = useState('');
  const [trainingStyle, setTrainingStyle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalSets = useMemo(
    () => day.exercises.reduce((sum, ex) => sum + (Number.isFinite(ex.sets) ? ex.sets : 0), 0),
    [day.exercises]
  );

  const regenerateDay = async () => {
    setError(null);
    setRegenerating(true);
    try {
      const res = await fetch('/api/workouts/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'day',
          date,
          equipment,
          training_style: trainingStyle,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to regenerate day.');
        return;
      }
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-accent-muted">{splitName}</p>
            <p className="mt-1 text-2xl font-display text-accent-white">{day.title}</p>
            <p className="mt-1 text-sm text-accent-muted">{day.focus}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-accent-muted">Total sets</p>
            <p className="mt-1 font-display text-2xl text-accent-gold">{totalSets}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <p className="text-sm font-medium text-accent-white">Exercises</p>
        <div className="mt-3 space-y-2">
          {day.exercises.map((ex) => (
            <div key={ex.exercise} className="flex items-center justify-between rounded-md bg-bg-secondary px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-accent-white truncate">{ex.exercise}</p>
                <p className="text-xs text-accent-muted">{ex.rest_sec}s rest</p>
              </div>
              <p className="font-mono text-xs text-accent-muted">{ex.sets} x {ex.reps}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6 space-y-3">
        <p className="text-sm font-medium text-accent-white">Regenerate this day only</p>
        <p className="text-xs text-accent-muted">
          This will replace only {date}. To regenerate the entire week, use “Regenerate Plans” on the main workouts page.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            placeholder="Optional: equipment access for today"
            className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
          <Input
            value={trainingStyle}
            onChange={(e) => setTrainingStyle(e.target.value)}
            placeholder="Optional: how you want to train today"
            className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
            onClick={regenerateDay}
            disabled={regenerating}
          >
            {regenerating ? 'Regenerating...' : 'Regenerate this day'}
          </Button>
          <Link href="/workouts">
            <Button type="button" variant="outline" className="border-bg-surface text-accent-muted hover:text-accent-white">
              Back to Workouts
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

