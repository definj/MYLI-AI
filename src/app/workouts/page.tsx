'use client';

import { useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';

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
};

type PlanPayload = {
  tiers: Tier[];
  note: string;
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

  const generatePlans = async () => {
    setError(null);
    setIsLoading(true);
    const response = await fetch('/api/workouts/generate', { method: 'POST' });
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

  return (
    <FeatureShell
      eyebrow="Workouts"
      title="Workout Plans"
      description="Generate AI-personalized workout plan tiers based on your physical profile and goals."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
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
      </div>
    </FeatureShell>
  );
}
