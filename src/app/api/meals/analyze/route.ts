import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runMealAnalysis } from '@/lib/meals/analyze';
import type { SupabaseClient } from '@supabase/supabase-js';

async function updateStreak(supabase: SupabaseClient, userId: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('streaks')
    .select('id, current_count, longest_count, last_date')
    .eq('user_id', userId)
    .eq('streak_type', 'meal')
    .maybeSingle();

  if (!existing) {
    await supabase.from('streaks').insert({
      user_id: userId, streak_type: 'meal', current_count: 1, longest_count: 1, last_date: todayStr,
    });
    return;
  }
  if (existing.last_date === todayStr) return;

  const last = new Date(existing.last_date);
  const now = new Date(todayStr);
  const consecutive = Math.round((now.getTime() - last.getTime()) / 86400000) === 1;
  const newCount = consecutive ? existing.current_count + 1 : 1;

  await supabase.from('streaks').update({
    current_count: newCount,
    longest_count: Math.max(existing.longest_count, newCount),
    last_date: todayStr,
  }).eq('id', existing.id);
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

  const mealType = (formData.get('meal_type') as string) || null;
  const restaurantUrl = (formData.get('restaurant_url') as string)?.trim() || null;

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const mediaType = file.type || 'image/jpeg';

  const { analysis, warning, rawText, parsed } = await runMealAnalysis(
    base64,
    mediaType,
    mealType,
    restaurantUrl
  );

  if (uploadError) {
    return NextResponse.json(
      { ...analysis, warning: `Upload failed; analysis only. ${uploadError.message}` },
      { status: 200 }
    );
  }

  const { data: publicUrlData } = supabase.storage.from('meal_photos').getPublicUrl(uploadData.path);

  await supabase.from('meal_logs').insert({
    user_id: user.id,
    photo_url: publicUrlData.publicUrl,
    meal_type: typeof mealType === 'string' && mealType !== 'unspecified' ? mealType : 'unspecified',
    calories: analysis.calories,
    protein_g: analysis.protein_g,
    carbs_g: analysis.carbs_g,
    fat_g: analysis.fat_g,
    fiber_g: analysis.fiber_g,
    ai_description: analysis.description,
    raw_ai_response: rawText ? { raw_text: rawText, parsed } : {},
  });

  void updateStreak(supabase, user.id);

  return NextResponse.json(warning ? { ...analysis, warning } : analysis);
}
