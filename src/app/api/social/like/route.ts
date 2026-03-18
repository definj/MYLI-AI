import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { post_id?: string };
  if (!body.post_id) {
    return NextResponse.json({ error: 'post_id is required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: post, error: fetchError } = await supabase
    .from('feed_posts')
    .select('id, likes_count')
    .eq('id', body.post_id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }

  const newCount = (post.likes_count ?? 0) + 1;
  await supabase
    .from('feed_posts')
    .update({ likes_count: newCount })
    .eq('id', post.id);

  return NextResponse.json({ likes_count: newCount });
}
