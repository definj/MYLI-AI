import { FeatureShell } from '@/components/app/feature-shell';
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
    <FeatureShell
      eyebrow="Social"
      title="Community Feed"
      description="Share milestones, follow peers, and react with intentional signals."
    >
      <SocialClient initialPosts={posts} initialLikedPostIds={likedPostIds} currentUserId={user?.id ?? null} />
    </FeatureShell>
  );
}
