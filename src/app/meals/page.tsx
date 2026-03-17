'use client';

import { useMemo, useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AnalysisResponse = {
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ingredients?: string[];
  confidence?: number;
};

export default function MealsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  const analyzeMeal = async () => {
    if (!file) return;
    setError(null);
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/meals/analyze', { method: 'POST', body: formData });
    setIsLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Unable to analyze meal.' }));
      setError(body.error || 'Unable to analyze meal.');
      return;
    }
    const body = (await response.json()) as AnalysisResponse;
    setAnalysis(body);
  };

  return (
    <FeatureShell
      eyebrow="Meals"
      title="Meal Logging"
      description="Capture, analyze, and confirm your meal macros before saving to your nutrition history."
    >
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <div className="space-y-4">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="h-12 bg-bg-secondary border-none text-accent-white file:text-accent-white"
          />
          <div className="flex gap-3">
            <Button
              type="button"
              className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
              onClick={analyzeMeal}
              disabled={!file || isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Analyze Meal'}
            </Button>
            <Button type="button" variant="outline" className="border-bg-surface text-accent-muted hover:text-accent-white" onClick={() => { setAnalysis(null); setFile(null); }}>
              Reset
            </Button>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Meal preview" className="max-h-80 rounded-lg border border-bg-surface object-cover" />
          )}
          {analysis && (
            <div className="grid gap-3 rounded-lg border border-bg-surface bg-bg-secondary p-4 text-sm">
              <p className="text-accent-muted">{analysis.description}</p>
              <p>Calories: {analysis.calories}</p>
              <p>Protein: {analysis.protein_g}g</p>
              <p>Carbs: {analysis.carbs_g}g</p>
              <p>Fat: {analysis.fat_g}g</p>
              <p>Fiber: {analysis.fiber_g}g</p>
            </div>
          )}
        </div>
      </div>
    </FeatureShell>
  );
}
