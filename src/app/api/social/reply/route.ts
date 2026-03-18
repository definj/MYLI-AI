import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type ReplyBody = {
  post_id?: string;
  content?: string;
  parent_reply_id?: string | null;
};

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
  const body = (await request.json().catch(() => ({}))) as ReplyBody;
  if (!body.post_id) {
    return NextResponse.json({ error: 'post_id is required.' }, { status: 400 });
  }

  const trimmed = (body.content ?? '').trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'content is required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: post, error: postError } = await supabase
    .from('feed_posts')
    .select('id')
    .eq('id', body.post_id)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  }

  let useFallbackReplies = false;
  if (body.parent_reply_id) {
    const { data: parentReply, error: parentReplyError } = await supabase
      .from('feed_post_replies')
      .select('id, post_id')
      .eq('id', body.parent_reply_id)
      .single();
    if (parentReplyError && isMissingRelationError(parentReplyError)) {
      useFallbackReplies = true;
    } else if (parentReplyError || !parentReply || parentReply.post_id !== post.id) {
      return NextResponse.json({ error: 'Invalid parent_reply_id.' }, { status: 400 });
    }
  }

  if (!useFallbackReplies) {
    const { data: reply, error: insertError } = await supabase
      .from('feed_post_replies')
      .insert({
        post_id: post.id,
        user_id: user.id,
        content: trimmed,
        parent_reply_id: body.parent_reply_id ?? null,
      })
      .select('id, post_id, user_id, parent_reply_id, content, created_at')
      .single();

    if (insertError) {
      if (!isMissingRelationError(insertError)) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      useFallbackReplies = true;
    } else {
      const { count, error: countError } = await supabase
        .from('feed_post_replies')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }

      const commentsCount = count ?? 0;
      const { error: updateError } = await supabase
        .from('feed_posts')
        .update({ comments_count: commentsCount })
        .eq('id', post.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ reply, comments_count: commentsCount });
    }
  }

  if (body.parent_reply_id) {
    const { data: fallbackParentReply, error: fallbackParentReplyError } = await supabase
      .from('feed_posts')
      .select('id, content')
      .eq('id', body.parent_reply_id)
      .eq('content_type', 'reply')
      .single();
    if (fallbackParentReplyError || !fallbackParentReply) {
      return NextResponse.json({ error: 'Invalid parent_reply_id.' }, { status: 400 });
    }
    const parentContent = toObjectContent(fallbackParentReply.content);
    if (String(parentContent.parent_post_id ?? '') !== post.id) {
      return NextResponse.json({ error: 'Invalid parent_reply_id.' }, { status: 400 });
    }
  }

  const { data: fallbackReply, error: fallbackInsertError } = await supabase
    .from('feed_posts')
    .insert({
      user_id: user.id,
      content_type: 'reply',
      visibility: 'public',
      content: {
        text: trimmed,
        parent_post_id: post.id,
        parent_reply_id: body.parent_reply_id ?? null,
      },
    })
    .select('id, user_id, content, created_at')
    .single();

  if (fallbackInsertError || !fallbackReply) {
    return NextResponse.json({ error: fallbackInsertError?.message ?? 'Failed to create reply.' }, { status: 500 });
  }

  const { data: allFallbackReplies, error: allRepliesError } = await supabase
    .from('feed_posts')
    .select('id, content')
    .eq('content_type', 'reply')
    .limit(1000);
  if (allRepliesError) {
    return NextResponse.json({ error: allRepliesError.message }, { status: 500 });
  }

  const commentsCount = (allFallbackReplies ?? []).filter((row) => {
    const content = toObjectContent(row.content);
    return String(content.parent_post_id ?? '') === post.id;
  }).length;

  const { error: fallbackUpdateError } = await supabase
    .from('feed_posts')
    .update({ comments_count: commentsCount })
    .eq('id', post.id);
  if (fallbackUpdateError) {
    return NextResponse.json({ error: fallbackUpdateError.message }, { status: 500 });
  }

  const fallbackReplyContent = toObjectContent(fallbackReply.content);
  return NextResponse.json({
    reply: {
      id: fallbackReply.id,
      post_id: String(fallbackReplyContent.parent_post_id ?? post.id),
      user_id: fallbackReply.user_id,
      parent_reply_id: fallbackReplyContent.parent_reply_id ? String(fallbackReplyContent.parent_reply_id) : null,
      content: String(fallbackReplyContent.text ?? ''),
      created_at: fallbackReply.created_at,
    },
    comments_count: commentsCount,
  });
}
