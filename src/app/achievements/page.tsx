import { FeatureShell } from '@/components/app/feature-shell';

const badges = [
  'First Meal Logged',
  '7-Day Streak',
  'Workout Warrior',
  'Mind Master',
  'Vitamin Scholar',
  'Iron Will',
];

export default function AchievementsPage() {
  return (
    <FeatureShell
      eyebrow="Achievements"
      title="Progress, XP, and Titles"
      description="Track your streak milestones, unlocked badges, and evolving MYLI identity."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {badges.map((badge) => (
          <div key={badge} className="rounded-xl border border-bg-surface bg-bg-surface/70 p-4">
            <p className="font-medium">{badge}</p>
            <p className="mt-1 text-sm text-accent-muted">Unlock condition attached to the streak and scoring engine.</p>
          </div>
        ))}
      </div>
    </FeatureShell>
  );
}
