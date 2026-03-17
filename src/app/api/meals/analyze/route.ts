import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicVisionJson, safeJsonParse } from '@/lib/ai/anthropic';

type MealAnalysis = {
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ingredients: string[];
  confidence: number;
};

function fallbackAnalysis() {
  return {
    description: 'Estimated mixed meal with lean protein and complex carbohydrates.',
    calories: 620,
    protein_g: 38,
    carbs_g: 58,
    fat_g: 22,
    fiber_g: 9,
    ingredients: ['lean protein', 'whole grains', 'mixed vegetables'],
    confidence: 0.53,
  } satisfies MealAnalysis;
}

function normalizeMealAnalysis(input: Partial<MealAnalysis> | null): MealAnalysis | null {
  if (!input) return null;
  if (typeof input.description !== 'string') return null;

  const toNum = (value: unknown) => {
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const calories = toNum(input.calories);
  const protein = toNum(input.protein_g);
  const carbs = toNum(input.carbs_g);
  const fat = toNum(input.fat_g);
  const fiber = toNum(input.fiber_g);
  const confidence = toNum(input.confidence);

  if (calories === null || protein === null || carbs === null || fat === null || fiber === null || confidence === null) {
    return null;
  }

  return {
    description: input.description,
    calories: Math.round(calories),
    protein_g: Number(protein.toFixed(1)),
    carbs_g: Number(carbs.toFixed(1)),
    fat_g: Number(fat.toFixed(1)),
    fiber_g: Number(fiber.toFixed(1)),
    ingredients: Array.isArray(input.ingredients) ? input.ingredients.map(String) : [],
    confidence: Math.min(1, Math.max(0, Number(confidence.toFixed(2)))),
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Please upload an image smaller than 8MB.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('meal_photos')
    .upload(`${user.id}/${Date.now()}-${file.name}`, file, { upsert: false });

  const fallback = fallbackAnalysis();
  if (uploadError) {
    return NextResponse.json(
      { ...fallback, warning: `Upload failed; using analysis fallback. ${uploadError.message}` },
      { status: 200 }
    );
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const mediaType = file.type || 'image/jpeg';

  const prompt =
    'Analyze this meal photo. Return JSON with: description (string), calories (number), protein_g (number), carbs_g (number), fat_g (number), fiber_g (number), ingredients (array of strings), confidence (0-1). Be precise and realistic. Return only valid JSON.';

  const aiResult = await callAnthropicVisionJson(
    base64,
    mediaType,
    prompt,
    'You are a nutrition vision analyst. Return strict JSON only.'
  );

  const parsed = aiResult.ok ? safeJsonParse<Partial<MealAnalysis>>(aiResult.text) : null;
  const analysis = normalizeMealAnalysis(parsed) ?? fallback;
  const warning = aiResult.ok
    ? parsed
      ? undefined
      : 'AI returned non-JSON output, fallback values were used.'
    : `AI unavailable (${aiResult.error}), fallback values were used.`;

  const { data: publicUrlData } = supabase.storage.from('meal_photos').getPublicUrl(uploadData.path);

  await supabase.from('meal_logs').insert({
    user_id: user.id,
    photo_url: publicUrlData.publicUrl,
    meal_type: 'unspecified',
    calories: analysis.calories,
    protein_g: analysis.protein_g,
    carbs_g: analysis.carbs_g,
    fat_g: analysis.fat_g,
    fiber_g: analysis.fiber_g,
    ai_description: analysis.description,
    raw_ai_response: aiResult.ok ? { raw_text: aiResult.text, parsed } : { error: aiResult.error },
  });

  return NextResponse.json(warning ? { ...analysis, warning } : analysis);
}
