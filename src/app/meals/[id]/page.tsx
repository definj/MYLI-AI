import { FeatureShell } from '@/components/app/feature-shell';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('meal_logs').select('*').eq('id', id).single();

  return (
    <FeatureShell
      eyebrow="Meals"
      title="Meal Detail"
      description="Detailed macro and AI analysis for a single logged meal."
    >
      <pre className="overflow-auto rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-xs text-accent-muted">
        {JSON.stringify(data ?? { id, message: 'No meal found.' }, null, 2)}
      </pre>
    </FeatureShell>
  );
}
