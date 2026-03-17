'use client';

import { useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';

export default function WorkoutsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [plans, setPlans] = useState<Record<string, unknown> | null>(null);
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
    setPlans(await response.json());
  };

  return (
    <FeatureShell
      eyebrow="Workouts"
      title="Workout Plans"
      description="Generate moderate, medium, and intense plan tiers personalized to your profile."
    >
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <Button
          type="button"
          className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
          onClick={generatePlans}
          disabled={isLoading}
        >
          {isLoading ? 'Generating...' : 'Generate 3-Tier Plan'}
        </Button>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {plans && (
          <pre className="mt-4 overflow-auto rounded-lg border border-bg-surface bg-bg-secondary p-4 text-xs text-accent-muted">
            {JSON.stringify(plans, null, 2)}
          </pre>
        )}
      </div>
    </FeatureShell>
  );
}
