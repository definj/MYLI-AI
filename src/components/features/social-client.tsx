'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export type FeedPost = { id: string; content: unknown; content_type: string; created_at: string };

export function SocialClient({ initialPosts }: { initialPosts: FeedPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from('feed_posts')
      .select('id, content, content_type, created_at')
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
    const { error: insertError } = await supabase
      .from('feed_posts')
      .insert({ content_type: 'text', content: { text: draft.trim() }, visibility: 'public' });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft('');
    void reload();
  };

  return (
    <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
      <div className="flex gap-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share a win..."
          className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
        />
        <Button
          type="button"
          className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
          onClick={createPost}
        >
          Post
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 space-y-3">
        {posts.map((post) => (
          <div key={post.id} className="rounded-md border border-bg-surface bg-bg-secondary p-3 text-sm">
            <p className="text-accent-muted">{JSON.stringify(post.content)}</p>
            <p className="mt-2 font-mono text-xs uppercase text-accent-muted">{new Date(post.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
