'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeatureShell } from '@/components/app/feature-shell';

type Badge = {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  newly_unlocked: boolean;
};

export default function AchievementsPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [celebration, setCelebration] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/achievements/check', { method: 'POST' });
      setIsLoading(false);
      if (!res.ok) return;
      const data = await res.json();
      setBadges(data.badges ?? []);
      if (data.newly_unlocked?.length > 0) {
        const first = data.badges.find((b: Badge) => b.key === data.newly_unlocked[0]);
        if (first) setCelebration(first.title);
        setTimeout(() => setCelebration(null), 3000);
      }
    };
    void load();
  }, []);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <FeatureShell
      eyebrow="Achievements"
      title="Progress & Badges"
      description={`You have unlocked ${unlockedCount} of ${badges.length} badges. Keep building momentum.`}
    >
      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card mb-4 rounded-2xl border-accent-gold/60 bg-accent-gold/10 p-4 text-center"
          >
            <p className="font-display text-xl text-accent-gold">Badge Unlocked!</p>
            <p className="mt-1 text-sm text-accent-white">{celebration}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {badges.map((badge) => (
            <motion.div
              key={badge.key}
              initial={badge.newly_unlocked ? { scale: 0.9, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`rounded-2xl border p-4 transition-colors ${
                badge.unlocked
                  ? 'glass-card border-accent-gold/40'
                  : 'glass-card border-bg-surface opacity-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-medium ${badge.unlocked ? 'text-accent-white' : 'text-accent-muted'}`}>
                  {badge.title}
                </p>
                {badge.unlocked && (
                  <span className="rounded-md bg-accent-gold/20 px-2 py-0.5 text-xs font-medium text-accent-gold">
                    Unlocked
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-accent-muted">{badge.description}</p>
            </motion.div>
          ))}
        </div>
      )}
    </FeatureShell>
  );
}
