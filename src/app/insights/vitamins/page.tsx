'use client';

import { useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';

export default function VitaminInsightsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setIsLoading(true);
    const response = await fetch('/api/insights/vitamins', { method: 'POST' });
    setIsLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Failed to generate vitamin report.' }));
      setError(body.error || 'Failed to generate vitamin report.');
      return;
    }
    setReport(await response.json());
  };

  return (
    <FeatureShell
      eyebrow="Insights / Vitamins"
      title="Vitamin Deficiency Analysis"
      description="Analyze the last 5 days of meal logs for likely deficiencies and recommendations."
    >
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <Button
          type="button"
          className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
          disabled={isLoading}
          onClick={generate}
        >
          {isLoading ? 'Analyzing...' : 'Generate Report'}
        </Button>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {report && (
          <pre className="mt-4 overflow-auto rounded-lg border border-bg-surface bg-bg-secondary p-4 text-xs text-accent-muted">
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </div>
    </FeatureShell>
  );
}
