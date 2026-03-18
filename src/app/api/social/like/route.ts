import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === '42P01';
}

function toObjectContent(content: unknown): Record<string, unknown> {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return content as Record<string, unknown>;
  }
  if (typeof content === 'string') {
    return { text: content };
  }
  return {};
}

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
    .select('id, likes_count, content')
    .eq('id', body.post_id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }

  const { data: existingLike, error: existingLikeError } = await supabase
    .from('feed_post_likes')
    .select('id')
    .eq('post_id', post.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingLikeError) {
    if (isMissingRelationError(existingLikeError)) {
      const contentObj = toObjectContent(post.content);
      const likedByRaw = Array.isArray(contentObj.likes_by) ? contentObj.likes_by : [];
      const likedBy = likedByRaw.map((value) => String(value));
      const hasLiked = likedBy.includes(user.id);
      const nextLikedBy = hasLiked
        ? likedBy.filter((id) => id !== user.id)
        : [...likedBy, user.id];
      const deduped = Array.from(new Set(nextLikedBy));
      const nextContent = { ...contentObj, likes_by: deduped };
      const newCount = deduped.length;
      const { error: fallbackUpdateError } = await supabase
        .from('feed_posts')
        .update({ likes_count: newCount, content: nextContent })
        .eq('id', post.id);
      if (fallbackUpdateError) {
        return NextResponse.json({ error: fallbackUpdateError.message }, { status: 500 });
      }
      return NextResponse.json({ likes_count: newCount, liked: !hasLiked });
    }
    return NextResponse.json({ error: existingLikeError.message }, { status: 500 });
  }

  let liked = false;
  if (existingLike) {
    const { error: unlikeError } = await supabase
      .from('feed_post_likes')
      .delete()
      .eq('id', existingLike.id);
    if (unlikeError) {
      return NextResponse.json({ error: unlikeError.message }, { status: 500 });
    }
    liked = false;
  } else {
    const { error: likeError } = await supabase
      .from('feed_post_likes')
      .insert({ post_id: post.id, user_id: user.id });
    if (likeError) {
      return NextResponse.json({ error: likeError.message }, { status: 500 });
    }
    liked = true;
  }

  const { count, error: countError } = await supabase
    .from('feed_post_likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post.id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const newCount = count ?? 0;
  const { error: updateError } = await supabase
    .from('feed_posts')
    .update({ likes_count: newCount })
    .eq('id', post.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ likes_count: newCount, liked });
}
