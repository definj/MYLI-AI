import { FeatureShell } from '@/components/app/feature-shell';
import { createClient } from '@/lib/supabase/server';
import { SocialClient, type FeedPost } from '@/components/features/social-client';

export const dynamic = 'force-dynamic';

export default async function SocialPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('feed_posts')
    .select('id, content, content_type, created_at, likes_count')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <FeatureShell
      eyebrow="Social"
      title="Community Feed"
      description="Share milestones, follow peers, and react with intentional signals."
    >
      <SocialClient initialPosts={(data ?? []) as FeedPost[]} />
    </FeatureShell>
  );
}
