import { createClient } from '@/lib/supabase/server';
import { SocialClient } from '@/components/features/social-client';
import { getSocialFeed } from '@/lib/social/feed';

export const dynamic = 'force-dynamic';

export default async function SocialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { posts, likedPostIds } = await getSocialFeed(supabase, user?.id ?? null, 20);

  return (
    <main className="min-h-full px-6 pb-24 pt-8 text-white lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Social</p>
          <h1 className="mt-1 text-3xl font-semibold">Community Feed</h1>
          <p className="mt-1 text-sm text-white/60">
            Share milestones, follow peers, and react with intentional signals.
          </p>
        </div>
        <SocialClient initialPosts={posts} initialLikedPostIds={likedPostIds} currentUserId={user?.id ?? null} />
      </div>
    </main>
  );
}
