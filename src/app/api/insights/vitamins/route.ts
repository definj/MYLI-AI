import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicText, safeJsonParse } from '@/lib/ai/anthropic';

type VitaminReport = {
  deficiencies: Array<{
    nutrient: string;
    severity: string;
    explanation: string;
  }>;
  recommendations: Array<{
    type: string;
    name: string;
    reason: string;
    dosage?: string;
  }>;
};

const fallbackReport: VitaminReport = {
  deficiencies: [
    {
      nutrient: 'Vitamin D',
      severity: 'medium',
      explanation: 'Meal pattern suggests low fatty fish and fortified foods.',
    },
  ],
  recommendations: [
    { type: 'food', name: 'Salmon', reason: 'High vitamin D density' },
    { type: 'supplement', name: 'Vitamin D3', reason: 'Support baseline intake', dosage: '1000 IU/day' },
  ],
};

function normalizeVitaminReport(input: Partial<VitaminReport> | null): VitaminReport | null {
  if (!input) return null;
  if (!Array.isArray(input.deficiencies) || !Array.isArray(input.recommendations)) return null;

  const deficiencies = input.deficiencies
    .map((item) => ({
      nutrient: String(item.nutrient ?? ''),
      severity: String(item.severity ?? ''),
      explanation: String(item.explanation ?? ''),
    }))
    .filter((item) => item.nutrient && item.severity && item.explanation);

  const recommendations = input.recommendations
    .map((item) => ({
      type: String(item.type ?? ''),
      name: String(item.name ?? ''),
      reason: String(item.reason ?? ''),
      dosage: item.dosage ? String(item.dosage) : undefined,
    }))
    .filter((item) => item.type && item.name && item.reason);

  if (deficiencies.length === 0 || recommendations.length === 0) return null;
  return { deficiencies, recommendations };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: meals } = await supabase
    .from('meal_logs')
    .select('id, logged_at, calories, protein_g, carbs_g, fat_g, fiber_g, ai_description')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(35);

  const ai = await callAnthropicText(
    [
      {
        role: 'user',
        content:
          'Based on these 5 days of meals, identify likely vitamin/mineral deficiencies and recommendations. Return JSON only as { deficiencies: [{nutrient,severity,explanation}], recommendations: [{type,name,reason,dosage}] }. Meals: ' +
          JSON.stringify(meals ?? []),
      },
    ],
    'You are a nutrition analysis assistant.'
  );

  let report: VitaminReport = fallbackReport;
  if (ai.ok) {
    const parsed = safeJsonParse<Partial<VitaminReport>>(ai.text);
    report = normalizeVitaminReport(parsed) ?? fallbackReport;
  }

  await supabase.from('vitamin_analysis').insert({
    user_id: user.id,
    deficiencies: report.deficiencies,
    recommendations: report.recommendations,
    meal_log_ids: (meals ?? []).map((m) => m.id),
  });

  return NextResponse.json(report);
}
