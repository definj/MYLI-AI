import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runMealAnalysis } from '@/lib/meals/analyze';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Meal ID required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('meal_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete meal.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Meal ID required.' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Image file is required to replace meal photo.' }, { status: 400 });
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

  const { data: existing } = await supabase
    .from('meal_logs')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Meal not found.' }, { status: 404 });
  }

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('meal_photos')
    .upload(`${user.id}/${Date.now()}-${file.name}`, file, { upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

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

  const { data: publicUrlData } = supabase.storage.from('meal_photos').getPublicUrl(uploadData.path);

  const { error: updateError } = await supabase
    .from('meal_logs')
    .update({
      photo_url: publicUrlData.publicUrl,
      meal_type: mealType && mealType !== 'unspecified' ? mealType : 'unspecified',
      calories: analysis.calories,
      protein_g: analysis.protein_g,
      carbs_g: analysis.carbs_g,
      fat_g: analysis.fat_g,
      fiber_g: analysis.fiber_g,
      ai_description: analysis.description,
      raw_ai_response: rawText ? { raw_text: rawText, parsed } : {},
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || 'Failed to update meal.' },
      { status: 500 }
    );
  }

  return NextResponse.json(warning ? { ...analysis, warning } : analysis);
}
