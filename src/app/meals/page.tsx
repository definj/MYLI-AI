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
  warning?: string;
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export default function MealsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mealType, setMealType] = useState<string>('lunch');
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
    </FeatureShell>
  );
}
