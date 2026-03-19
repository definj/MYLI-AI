import { callAnthropicVisionJson, safeJsonParse } from '@/lib/ai/anthropic';

export type MealAnalysis = {
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ingredients: string[];
  confidence: number;
};

export function fallbackAnalysis(): MealAnalysis {
  return {
    description: 'Estimated mixed meal with lean protein and complex carbohydrates.',
    calories: 620,
    protein_g: 38,
    carbs_g: 58,
    fat_g: 22,
    fiber_g: 9,
    ingredients: ['lean protein', 'whole grains', 'mixed vegetables'],
    confidence: 0.53,
  };
}

export function normalizeMealAnalysis(input: Partial<MealAnalysis> | null): MealAnalysis | null {
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

const SYSTEM_PROMPT = `You are an expert nutrition analyst. Your goal is to estimate meal macros with high accuracy (aim for 90%+ confidence when the image and context are clear).

Rules:
- Use standard portion references: fist ≈ 1 cup, palm ≈ 3–4 oz protein, thumb ≈ 1 tbsp.
- For packaged or branded items, use known nutrition when possible.
- If a restaurant or menu link is provided, prefer official nutrition data from that source when inferable.
- Only set confidence to 0.9 or above when you can identify most items and portions with high certainty; otherwise use 0.7–0.85.
- Return strict JSON only; no markdown, no explanation.`;

function buildPrompt(mealType: string | null, restaurantUrl: string | null): string {
  const mealHint = mealType && mealType !== 'unspecified' ? ` This is a ${mealType} meal.` : '';
  const urlHint = restaurantUrl
    ? ` The user provided this restaurant or menu link for reference (use it to improve accuracy when possible): ${restaurantUrl}`
    : '';

  return `Analyze this meal photo.${mealHint}${urlHint}

Estimate the total nutritional content of everything visible on the plate/tray. Be precise: use standard portion sizes (e.g. fist = ~1 cup, palm = 3–4 oz protein), consider cooking oils and sauces, and prefer known nutrition for recognizable branded or restaurant items.

Return a single JSON object with these exact keys:
- description (string): 1–2 sentence summary of the meal
- calories (number): total kcal
- protein_g (number)
- carbs_g (number)
- fat_g (number)
- fiber_g (number)
- ingredients (array of strings): each identified food item
- confidence (number 0–1): only use 0.9+ when you are highly confident in the estimate; otherwise 0.7–0.89.`;
}

export async function runMealAnalysis(
  base64: string,
  mediaType: string,
  mealType: string | null,
  restaurantUrl: string | null
): Promise<{ analysis: MealAnalysis; warning?: string; rawText?: string; parsed?: unknown }> {
  const prompt = buildPrompt(mealType, restaurantUrl);
  const fallback = fallbackAnalysis();

  const aiResult = await callAnthropicVisionJson(base64, mediaType, prompt, SYSTEM_PROMPT);
  const parsed = aiResult.ok ? safeJsonParse<Partial<MealAnalysis>>(aiResult.text) : null;
  const analysis = normalizeMealAnalysis(parsed) ?? fallback;

  const warning = aiResult.ok
    ? parsed
      ? undefined
      : 'AI returned non-JSON output, fallback values were used.'
    : `AI unavailable (${aiResult.error}), fallback values were used.`;

  return {
    analysis,
    warning,
    rawText: aiResult.ok ? aiResult.text : undefined,
    parsed: parsed ?? undefined,
  };
}
