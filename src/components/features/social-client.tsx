'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import type { FeedPost } from '@/lib/social/types';

type SortOption = 'newest' | 'oldest' | 'most_liked' | 'most_discussed';

function getPostText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as Record<string, unknown>).text);
  }
  return '';
}

function getPostImageUrl(content: unknown): string | null {
  if (content && typeof content === 'object' && 'image_url' in content) {
    const raw = (content as Record<string, unknown>).image_url;
    if (typeof raw !== 'string') return null;
    const value = raw.trim();
    if (!value || value === 'null' || value === 'undefined') return null;
    if (value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
  }
  return null;
}

type FeedPayload = {
  posts: FeedPost[];
  likedPostIds: string[];
  error?: string;
};

export function SocialClient({
  initialPosts,
  initialLikedPostIds,
  currentUserId,
}: {
  initialPosts: FeedPost[];
  initialLikedPostIds: string[];
  currentUserId: string | null;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set(initialLikedPostIds));
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set());
  const [expandedThreadPostIds, setExpandedThreadPostIds] = useState<Set<string>>(new Set());
  const [replyDraftsByPost, setReplyDraftsByPost] = useState<Record<string, string>>({});
  const [replyTargetByPost, setReplyTargetByPost] = useState<Record<string, string | null>>({});
  const [replyingPostIds, setReplyingPostIds] = useState<Set<string>>(new Set());
  const [deletingPostIds, setDeletingPostIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const reload = async () => {
    const res = await fetch('/api/social/feed', { cache: 'no-store' });
    const payload = (await res.json().catch(() => ({ error: 'Failed to load feed.' }))) as FeedPayload;
    if (!res.ok || payload.error) {
      setError(payload.error ?? 'Failed to load feed.');
      return;
    }
    setPosts(payload.posts ?? []);
    setLikedPostIds(new Set(payload.likedPostIds ?? []));
  };

  const sortedPosts = useMemo(() => {
    const copy = [...posts];
    copy.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'most_liked') {
        const byLikes = (b.likes_count ?? 0) - (a.likes_count ?? 0);
        if (byLikes !== 0) return byLikes;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'most_discussed') {
        const byComments = (b.comments_count ?? 0) - (a.comments_count ?? 0);
        if (byComments !== 0) return byComments;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return copy;
  }, [posts, sortBy]);

  const createPost = async () => {
    const supabase = createClient();
    const trimmedText = draft.trim();
    if (!trimmedText && !imageFile) return;
    setIsPosting(true);
    setError(null);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setIsPosting(false);
      setError('You must be signed in to post.');
      return;
    }

    let imageUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${authData.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('social_images')
        .upload(filePath, imageFile, { upsert: false });
      if (uploadError) {
        setIsPosting(false);
        setError(uploadError.message);
        return;
      }
      const { data: publicUrlData } = supabase.storage
        .from('social_images')
        .getPublicUrl(uploadData.path);
      imageUrl = publicUrlData.publicUrl;
    }

    const { error: insertError } = await supabase
      .from('feed_posts')
      .insert({
        user_id: authData.user.id,
        content_type: imageUrl && trimmedText ? 'text_image' : imageUrl ? 'image' : 'text',
        content: { text: trimmedText, image_url: imageUrl },
        visibility: 'public',
      });
    setIsPosting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft('');
    setImageFile(null);
    void reload();
  };

  const likePost = async (postId: string) => {
    if (likingPostIds.has(postId)) return;
    setLikingPostIds((prev) => new Set(prev).add(postId));
    const res = await fetch('/api/social/like', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    });
    if (res.ok) {
      const payload = (await res.json()) as { likes_count?: number; liked?: boolean };
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes_count: payload.likes_count ?? p.likes_count ?? 0 } : p
        )
      );
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (payload.liked) {
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });
    } else {
      const payload = (await res.json().catch(() => ({ error: 'Failed to like post.' }))) as {
        error?: string;
      };
      setError(payload.error ?? 'Failed to like post.');
    }
    setLikingPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  const createReply = async (postId: string) => {
    const replyText = (replyDraftsByPost[postId] ?? '').trim();
    if (!replyText || replyingPostIds.has(postId)) return;

    setReplyingPostIds((prev) => new Set(prev).add(postId));
    setError(null);
    const res = await fetch('/api/social/reply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        post_id: postId,
        content: replyText,
        parent_reply_id: replyTargetByPost[postId] ?? null,
      }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({ error: 'Failed to post reply.' }))) as {
        error?: string;
      };
      setError(payload.error ?? 'Failed to post reply.');
    } else {
      setReplyDraftsByPost((prev) => ({ ...prev, [postId]: '' }));
      setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
      await reload();
    }
    setReplyingPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  const deletePost = async (postId: string) => {
    if (!currentUserId || deletingPostIds.has(postId)) return;
    setDeletingPostIds((prev) => new Set(prev).add(postId));
    setError(null);
    const res = await fetch('/api/social/post', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({ error: 'Failed to delete post.' }))) as {
        error?: string;
      };
      setError(payload.error ?? 'Failed to delete post.');
    } else {
      await reload();
    }
    setDeletingPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-accent-muted">Share a win</p>
        <div className="flex flex-col gap-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share text, add an image, or both..."
            className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="h-11 bg-bg-secondary border-none text-accent-muted file:mr-2 file:rounded-md file:border-0 file:bg-bg-primary file:px-3 file:py-1.5 file:text-accent-white md:flex-1"
            />
            <Button
              type="button"
              className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
              onClick={createPost}
              disabled={isPosting || (!draft.trim() && !imageFile)}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-accent-muted">Posts can include text only, image only, or text + image.</p>
        {imageFile && (
          <p className="mt-2 text-xs text-accent-muted">
            Attached image: {imageFile.name}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      <div className="flex items-center gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-accent-muted">Sort</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="rounded-md border border-bg-surface bg-bg-surface px-3 py-1.5 text-sm text-accent-white"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most_liked">Most liked</option>
          <option value="most_discussed">Most discussed</option>
        </select>
      </div>

      <AnimatePresence mode="popLayout">
        {sortedPosts.map((post) => {
          const text = getPostText(post.content);
          const imageUrl = getPostImageUrl(post.content);
          const isLiked = likedPostIds.has(post.id);
          const isThreadOpen = expandedThreadPostIds.has(post.id);
          const replies = [...(post.replies ?? [])].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const rootReplies = replies.filter((reply) => !reply.parent_reply_id);
          const childReplies = replies.filter((reply) => Boolean(reply.parent_reply_id));

          return (
            <motion.div
              key={post.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5"
            >
              {text && <p className="text-sm text-accent-white">{text}</p>}
              {imageUrl && (
                <div className="mt-3 overflow-hidden rounded-lg border border-bg-surface">
                  <Image
                    src={imageUrl}
                    alt="Post image"
                    width={800}
                    height={500}
                    className="h-auto w-full object-cover"
                  />
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => likePost(post.id)}
                  disabled={likingPostIds.has(post.id)}
                  className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-3 py-1.5 text-xs text-accent-muted transition-colors hover:text-accent-gold disabled:opacity-60"
                >
                  <span className={isLiked ? 'text-accent-gold' : ''}>&#9829;</span>
                  <span>{post.likes_count ?? 0}</span>
                </button>
                <div className="flex items-center gap-2">
                  {currentUserId === post.user_id && (
                    <button
                      type="button"
                      onClick={() => void deletePost(post.id)}
                      disabled={deletingPostIds.has(post.id)}
                      className="rounded-md bg-bg-secondary px-3 py-1.5 text-xs text-danger transition-colors hover:text-danger/80 disabled:opacity-60"
                    >
                      {deletingPostIds.has(post.id) ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-md bg-bg-secondary px-3 py-1.5 text-xs text-accent-muted transition-colors hover:text-accent-gold"
                    onClick={() =>
                      setExpandedThreadPostIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(post.id)) {
                          next.delete(post.id);
                        } else {
                          next.add(post.id);
                        }
                        return next;
                      })
                    }
                  >
                    Thread ({post.comments_count ?? 0})
                  </button>
                  <p className="font-mono text-xs text-accent-muted">
                    {new Date(post.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {isThreadOpen && (
                <div className="mt-4 rounded-lg border border-bg-surface bg-bg-secondary/40 p-3">
                  <div className="space-y-3">
                    {rootReplies.map((reply) => (
                      <div key={reply.id} className="rounded-md bg-bg-secondary p-3">
                        <p className="text-sm text-accent-white">{reply.content}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="text-xs text-accent-muted hover:text-accent-gold"
                            onClick={() =>
                              setReplyTargetByPost((prev) => ({ ...prev, [post.id]: reply.id }))
                            }
                          >
                            Reply
                          </button>
                          <p className="font-mono text-xs text-accent-muted">
                            {new Date(reply.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>

                        {childReplies
                          .filter((child) => child.parent_reply_id === reply.id)
                          .map((child) => (
                            <div
                              key={child.id}
                              className="mt-2 rounded-md border border-bg-surface bg-bg-primary/40 p-2"
                            >
                              <p className="text-xs text-accent-white">{child.content}</p>
                            </div>
                          ))}
                      </div>
                    ))}
                    {replies.length === 0 && (
                      <p className="text-sm text-accent-muted">No replies yet. Start the thread.</p>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Input
                      value={replyDraftsByPost[post.id] ?? ''}
                      onChange={(e) =>
                        setReplyDraftsByPost((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder="Write a reply..."
                      className="h-10 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
                    />
                    <Button
                      type="button"
                      className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
                      disabled={replyingPostIds.has(post.id) || !(replyDraftsByPost[post.id] ?? '').trim()}
                      onClick={() => void createReply(post.id)}
                    >
                      {replyingPostIds.has(post.id) ? 'Sending...' : 'Reply'}
                    </Button>
                  </div>

                  {replyTargetByPost[post.id] && (
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-accent-muted">Replying to a thread message.</p>
                      <button
                        type="button"
                        className="text-xs text-accent-muted hover:text-accent-gold"
                        onClick={() =>
                          setReplyTargetByPost((prev) => ({ ...prev, [post.id]: null }))
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {sortedPosts.length === 0 && (
        <div className="rounded-xl border border-bg-surface bg-bg-surface/40 p-8 text-center">
          <p className="text-accent-muted">No posts yet. Be the first to share a win.</p>
        </div>
      )}
    </div>
  );
}
