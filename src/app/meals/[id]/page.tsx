import { FeatureShell } from '@/components/app/feature-shell';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MealDetailClient } from '@/components/features/meal-detail-client';

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
        <MealDetailClient meal={data} />
      )}
    </FeatureShell>
  );
}
