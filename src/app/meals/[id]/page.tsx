import { FeatureShell } from '@/components/app/feature-shell';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('meal_logs').select('*').eq('id', id).single();

  return (
    <FeatureShell
      eyebrow="Meals"
      title="Meal Detail"
      description="Detailed macro breakdown and AI analysis for this logged meal."
    >
      {!data ? (
        <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6 text-center">
          <p className="text-accent-muted">No meal log found.</p>
          <Link href="/meals" className="mt-4 inline-flex rounded-md bg-accent-gold px-4 py-2 text-sm font-medium text-bg-primary hover:bg-accent-gold/90">
            Back to Meals
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photo_url}
              alt="Meal photo"
              className="max-h-80 w-full rounded-xl border border-bg-surface object-cover"
            />
          )}

          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
              <p className="text-xs text-accent-muted">Calories</p>
              <p className="mt-1 font-display text-2xl text-accent-gold">{data.calories ?? '--'}</p>
            </div>
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
              <p className="text-xs text-accent-muted">Protein</p>
              <p className="mt-1 font-display text-2xl">{data.protein_g ?? '--'}g</p>
            </div>
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
              <p className="text-xs text-accent-muted">Carbs</p>
              <p className="mt-1 font-display text-2xl">{data.carbs_g ?? '--'}g</p>
            </div>
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
              <p className="text-xs text-accent-muted">Fat</p>
              <p className="mt-1 font-display text-2xl">{data.fat_g ?? '--'}g</p>
            </div>
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-center">
              <p className="text-xs text-accent-muted">Fiber</p>
              <p className="mt-1 font-display text-2xl">{data.fiber_g ?? '--'}g</p>
            </div>
          </div>

          {data.ai_description && (
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-2">AI Analysis</p>
              <p className="text-sm text-accent-white">{data.ai_description}</p>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm text-accent-muted">
            <span className="capitalize">{data.meal_type ?? 'unspecified'}</span>
            <span>&middot;</span>
            <span>{data.logged_at ? new Date(data.logged_at).toLocaleString() : '--'}</span>
          </div>

          <Link href="/meals" className="inline-flex rounded-md border border-bg-surface bg-bg-secondary px-4 py-2 text-sm text-accent-white hover:bg-bg-primary">
            Back to Meals
          </Link>
        </div>
      )}
    </FeatureShell>
  );
}
