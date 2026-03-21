import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const INTENSITY_ORDER = ['moderate', 'medium', 'intense'] as const;

type PlanRow = {
  id: string;
  intensity: string;
  generated_at: string;
  active: boolean | null;
  plan_json: Record<string, unknown> | null;
};

/** Latest generation: rows near max(generated_at), one row per intensity (dedup). */
function buildLatestTierBatch(rows: PlanRow[]): PlanRow[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  const maxTs = new Date(sorted[0].generated_at).getTime();
  const windowMs = 15_000;
  const near = sorted.filter((r) => Math.abs(new Date(r.generated_at).getTime() - maxTs) <= windowMs);
  const byIntensity = new Map<string, PlanRow>();
  for (const r of near) {
    const cur = byIntensity.get(r.intensity);
    if (!cur || new Date(r.generated_at) > new Date(cur.generated_at)) {
      byIntensity.set(r.intensity, r);
    }
  }
  return sortTiers([...byIntensity.values()]);
}

function sortTiers(batch: PlanRow[]): PlanRow[] {
  return [...batch].sort(
    (a, b) =>
      INTENSITY_ORDER.indexOf(a.intensity as (typeof INTENSITY_ORDER)[number]) -
      INTENSITY_ORDER.indexOf(b.intensity as (typeof INTENSITY_ORDER)[number])
  );
}

/**
 * GET — load latest generated workout tiers + active tier for hydration after refresh.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: rows, error } = await supabase
    .from('workout_plans')
    .select('id, intensity, generated_at, active, plan_json')
    .eq('user_id', user.id)
    .order('generated_at', { ascending: false })
    .limit(60);

  if (error) {
    console.error('[workout/plans GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows?.length) {
    return NextResponse.json({
      tiers: [],
      note: null,
      activeTierIndex: null,
      activatedTierIndex: null,
      equipment: '',
      trainingStyle: '',
      weekStart: null,
    });
  }

  const batch = buildLatestTierBatch(rows as PlanRow[]);
  if (batch.length === 0) {
    return NextResponse.json({
      tiers: [],
      note: null,
      activeTierIndex: null,
      activatedTierIndex: null,
      equipment: '',
      trainingStyle: '',
      weekStart: null,
    });
  }

  const tiers = batch.map((row) => {
    const j = (row.plan_json ?? {}) as Record<string, unknown>;
    return {
      intensity: row.intensity,
      weekly_days: Number(j.weekly_days ?? 0),
      focus: String(j.focus ?? ''),
      sample_day: Array.isArray(j.sample_day) ? j.sample_day : [],
      week_plan: j.week_plan ?? undefined,
    };
  });

  const meta = (batch[0].plan_json as { meta?: { equipment?: string; training_style?: string; week_start?: string } })
    ?.meta;

  const activeIdx = batch.findIndex((r) => r.active === true);
  const safeActive = activeIdx >= 0 ? activeIdx : tiers.length - 1;

  return NextResponse.json({
    tiers,
    note: 'Loaded from saved workout plans.',
    activeTierIndex: safeActive,
    activatedTierIndex: safeActive,
    equipment: meta?.equipment ?? '',
    trainingStyle: meta?.training_style ?? '',
    weekStart: meta?.week_start ?? null,
  });
}
