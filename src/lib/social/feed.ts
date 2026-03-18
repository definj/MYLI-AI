import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedPost, FeedReply } from '@/lib/social/types';

type FeedResponse = {
  posts: FeedPost[];
  likedPostIds: string[];
};

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeCode = (error as { code?: string }).code;
  return maybeCode === '42P01';
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

export async function getSocialFeed(
  supabase: SupabaseClient,
  userId: string | null,
  limit = 20
): Promise<FeedResponse> {
  const { data: postRows, error: postError } = await supabase
    .from('feed_posts')
    .select('id, user_id, content, content_type, created_at, likes_count, comments_count')
    .neq('content_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (postError) {
    throw postError;
  }

  const posts = ((postRows ?? []) as FeedPost[]).map((post) => ({ ...post, replies: [] }));
  const postIds = posts.map((post) => post.id);
  const repliesByPostId = new Map<string, FeedReply[]>();
  let likedPostIds: string[] = [];

  if (postIds.length > 0) {
    const { data: repliesRows, error: repliesError } = await supabase
      .from('feed_post_replies')
      .select('id, post_id, user_id, parent_reply_id, content, created_at')
      .in('post_id', postIds)
      .order('created_at', { ascending: true });

    if (repliesError) {
      if (!isMissingRelationError(repliesError)) {
        throw repliesError;
      }
      const { data: fallbackReplyRows, error: fallbackReplyError } = await supabase
        .from('feed_posts')
        .select('id, user_id, content, created_at')
        .eq('content_type', 'reply')
        .order('created_at', { ascending: true })
        .limit(500);
      if (fallbackReplyError) {
        throw fallbackReplyError;
      }
      for (const row of fallbackReplyRows ?? []) {
        const content = toObjectContent(row.content);
        const parentPostId = String(content.parent_post_id ?? '');
        if (!postIds.includes(parentPostId)) continue;
        const reply: FeedReply = {
          id: row.id,
          post_id: parentPostId,
          user_id: row.user_id,
          parent_reply_id: content.parent_reply_id ? String(content.parent_reply_id) : null,
          content: String(content.text ?? ''),
          created_at: row.created_at,
        };
        const list = repliesByPostId.get(parentPostId) ?? [];
        list.push(reply);
        repliesByPostId.set(parentPostId, list);
      }
    } else {
      for (const reply of (repliesRows ?? []) as FeedReply[]) {
        const list = repliesByPostId.get(reply.post_id) ?? [];
        list.push(reply);
        repliesByPostId.set(reply.post_id, list);
      }
    }

    if (userId) {
      const { data: likeRows, error: likeError } = await supabase
        .from('feed_post_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      if (likeError) {
        if (!isMissingRelationError(likeError)) {
          throw likeError;
        }
        likedPostIds = posts
          .filter((post) => {
            const content = toObjectContent(post.content);
            const likedBy = Array.isArray(content.likes_by) ? content.likes_by : [];
            return likedBy.some((id) => String(id) === userId);
          })
          .map((post) => post.id);
      } else {
        likedPostIds = (likeRows ?? []).map((row) => row.post_id as string);
      }
    }
  }

  const merged = posts.map((post) => ({
    ...post,
    replies: repliesByPostId.get(post.id) ?? [],
    comments_count: (repliesByPostId.get(post.id) ?? []).length || post.comments_count || 0,
  }));

  return { posts: merged, likedPostIds };
}
