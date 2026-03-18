'use client';

import { useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';

type Deficiency = {
  nutrient: string;
  severity: string;
  explanation: string;
};

type Recommendation = {
  type: string;
  name: string;
  reason: string;
  dosage?: string;
};

type VitaminReport = {
  deficiencies: Deficiency[];
  recommendations: Recommendation[];
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'text-accent-muted',
  medium: 'text-warning',
  high: 'text-danger',
};

export default function VitaminInsightsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<VitaminReport | null>(null);
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
      description="Analyze the last 5 days of meal logs for likely vitamin and mineral deficiencies."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
          <Button
            type="button"
            className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
            disabled={isLoading}
            onClick={generate}
          >
            {isLoading ? 'Analyzing meals...' : report ? 'Regenerate Report' : 'Generate Report'}
          </Button>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>

        {report && (
          <>
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-4">Potential Deficiencies</p>
              {report.deficiencies.length === 0 ? (
                <p className="text-sm text-accent-muted">No deficiencies detected. Keep up the balanced diet.</p>
              ) : (
                <div className="space-y-3">
                  {report.deficiencies.map((d) => (
                    <div key={d.nutrient} className="rounded-md bg-bg-secondary p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-accent-white">{d.nutrient}</p>
                        <span className={`font-mono text-xs uppercase tracking-widest ${SEVERITY_COLORS[d.severity] ?? 'text-accent-muted'}`}>
                          {d.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-accent-muted">{d.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-4">Recommendations</p>
              {report.recommendations.length === 0 ? (
                <p className="text-sm text-accent-muted">No specific recommendations at this time.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {report.recommendations.map((r) => (
                    <div key={`${r.type}-${r.name}`} className="rounded-md bg-bg-secondary p-4">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                          r.type === 'supplement'
                            ? 'bg-accent-gold/20 text-accent-gold'
                            : 'bg-success/20 text-success'
                        }`}>
                          {r.type}
                        </span>
                        <p className="font-medium text-accent-white">{r.name}</p>
                      </div>
                      <p className="mt-2 text-sm text-accent-muted">{r.reason}</p>
                      {r.dosage && (
                        <p className="mt-1 font-mono text-xs text-accent-muted">{r.dosage}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </FeatureShell>
  );
}
