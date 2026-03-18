'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export type FeedPost = {
  id: string;
  content: unknown;
  content_type: string;
  created_at: string;
  likes_count?: number;
};

function getPostText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as Record<string, unknown>).text);
  }
  return '';
}

export function SocialClient({ initialPosts }: { initialPosts: FeedPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const reload = async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from('feed_posts')
      .select('id, content, content_type, created_at, likes_count')
      .order('created_at', { ascending: false })
      .limit(20);
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setPosts((data ?? []) as FeedPost[]);
  };

  const createPost = async () => {
    const supabase = createClient();
    if (!draft.trim()) return;
    setIsPosting(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('feed_posts')
      .insert({ content_type: 'text', content: { text: draft.trim() }, visibility: 'public' });
    setIsPosting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft('');
    void reload();
  };

  const likePost = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likes_count: (p.likes_count ?? 0) + 1 } : p
      )
    );
    const res = await fetch('/api/social/like', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    });
    if (!res.ok) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likes_count: Math.max(0, (p.likes_count ?? 1) - 1) } : p
        )
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-accent-muted">Share a win</p>
        <div className="flex gap-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void createPost(); }}
            placeholder="I just hit a new PR..."
            className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
          <Button
            type="button"
            className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
            onClick={createPost}
            disabled={isPosting || !draft.trim()}
          >
            {isPosting ? 'Posting...' : 'Post'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      <AnimatePresence mode="popLayout">
        {posts.map((post) => {
          const text = getPostText(post.content);
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
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => likePost(post.id)}
                  className="flex items-center gap-1.5 rounded-md bg-bg-secondary px-3 py-1.5 text-xs text-accent-muted transition-colors hover:text-accent-gold"
                >
                  <span>&#9829;</span>
                  <span>{post.likes_count ?? 0}</span>
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
            </motion.div>
          );
        })}
      </AnimatePresence>

      {posts.length === 0 && (
        <div className="rounded-xl border border-bg-surface bg-bg-surface/40 p-8 text-center">
          <p className="text-accent-muted">No posts yet. Be the first to share a win.</p>
        </div>
      )}
    </div>
  );
}
