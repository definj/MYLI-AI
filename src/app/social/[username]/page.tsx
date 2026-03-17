import { FeatureShell } from '@/components/app/feature-shell';

export default async function SocialProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return (
    <FeatureShell
      eyebrow="Social Profile"
      title={`@${username}`}
      description="Public profile and shared activity timeline."
    />
  );
}
