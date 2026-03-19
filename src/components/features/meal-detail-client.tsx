'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type MealLog = {
  id: string;
  photo_url: string | null;
  meal_type: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  ai_description: string | null;
  logged_at: string | null;
};

export function MealDetailClient({ meal }: { meal: MealLog }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceRestaurantUrl, setReplaceRestaurantUrl] = useState('');
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm('Delete this meal log?')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' });
      if (res.ok) router.push('/meals');
      else setReplaceError('Failed to delete.');
    } finally {
      setDeleting(false);
    }
  };

  const handleReplace = async () => {
    if (!replaceFile) {
      setReplaceError('Choose an image first.');
      return;
    }
    setReplaceError(null);
    setReplacing(true);
    try {
      const formData = new FormData();
      formData.append('file', replaceFile);
      formData.append('meal_type', meal.meal_type ?? 'unspecified');
      if (replaceRestaurantUrl.trim()) formData.append('restaurant_url', replaceRestaurantUrl.trim());
      const res = await fetch(`/api/meals/${meal.id}`, { method: 'PATCH', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setReplaceError(body.error || 'Failed to update meal.');
        return;
      }
      router.refresh();
      setReplaceFile(null);
      setReplaceRestaurantUrl('');
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="space-y-4">
      {meal.photo_url && (
        <div className="flex max-h-96 w-full justify-center rounded-xl border border-bg-surface bg-bg-secondary p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meal.photo_url}
            alt="Meal photo"
            className="max-h-80 w-full object-contain"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
          <p className="text-xs text-accent-muted">Calories</p>
          <p className="mt-1 font-display text-2xl text-accent-gold">{meal.calories ?? '--'}</p>
        </div>
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
          <p className="text-xs text-accent-muted">Protein</p>
          <p className="mt-1 font-display text-2xl">{meal.protein_g ?? '--'}g</p>
        </div>
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
          <p className="text-xs text-accent-muted">Carbs</p>
          <p className="mt-1 font-display text-2xl">{meal.carbs_g ?? '--'}g</p>
        </div>
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
          <p className="text-xs text-accent-muted">Fat</p>
          <p className="mt-1 font-display text-2xl">{meal.fat_g ?? '--'}g</p>
        </div>
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
          <p className="text-xs text-accent-muted">Fiber</p>
          <p className="mt-1 font-display text-2xl">{meal.fiber_g ?? '--'}g</p>
        </div>
      </div>

      {meal.ai_description && (
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-2">AI Analysis</p>
          <p className="text-sm text-accent-white">{meal.ai_description}</p>
        </div>
      )}

      <div className="flex items-center gap-3 text-sm text-accent-muted">
        <span className="capitalize">{meal.meal_type ?? 'unspecified'}</span>
        <span>&middot;</span>
        <span>{meal.logged_at ? new Date(meal.logged_at).toLocaleString() : '--'}</span>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-bg-surface pt-4">
        <Button
          type="button"
          variant="outline"
          className="border-danger/50 text-danger hover:bg-danger/10"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete meal'}
        </Button>
        <Link href="/meals">
          <Button type="button" variant="outline" className="border-bg-surface text-accent-muted hover:text-accent-white">
            Back to Meals
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-bg-surface bg-bg-surface/50 p-4 space-y-3">
        <p className="text-sm font-medium text-accent-white">Replace photo & re-analyze</p>
        <p className="text-xs text-accent-muted">Upload a new image to update this meal’s photo and macro estimates.</p>
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
          className="h-10 bg-bg-secondary border-none text-accent-white file:text-accent-white"
        />
        <Input
          type="url"
          placeholder="Optional: restaurant or menu link"
          value={replaceRestaurantUrl}
          onChange={(e) => setReplaceRestaurantUrl(e.target.value)}
          className="h-10 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
        />
        {replaceError && <p className="text-sm text-danger">{replaceError}</p>}
        <Button
          type="button"
          className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
          onClick={handleReplace}
          disabled={!replaceFile || replacing}
        >
          {replacing ? 'Updating...' : 'Replace & re-analyze'}
        </Button>
      </div>
    </div>
  );
}
