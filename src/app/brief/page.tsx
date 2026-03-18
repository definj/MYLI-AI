'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';

type Brief = {
  greeting: string;
  body_summary: string;
  mind_summary: string;
  priorities: string[];
  motivation: string;
  cached?: boolean;
};

export default function DailyBriefPage() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (force = false) => {
    setIsLoading(true);
    setError(null);
    const res = await fetch('/api/brief/generate', { method: 'POST' });
    setIsLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Failed to generate brief.' }));
      setError(body.error || 'Failed to generate brief.');
      return;
    }
    setBrief(await res.json());
  };

  useEffect(() => { void load(); }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <FeatureShell
      eyebrow={today}
      title="Daily Brief"
      description="Your AI-generated morning summary with yesterday's review and today's priorities."
    >
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-bg-surface/40" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-bg-surface/70 p-6">
          <p className="text-sm text-danger">{error}</p>
          <Button onClick={() => load(true)} className="mt-3 bg-accent-gold text-bg-primary hover:bg-accent-gold/90">
            Retry
          </Button>
        </div>
      ) : brief ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
            <p className="font-display text-2xl text-accent-white">{brief.greeting}</p>
          </div>

          {brief.body_summary && (
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-2">Body</p>
              <p className="text-sm text-accent-white leading-relaxed">{brief.body_summary}</p>
            </div>
          )}

          {brief.mind_summary && (
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-2">Mind</p>
              <p className="text-sm text-accent-white leading-relaxed">{brief.mind_summary}</p>
            </div>
          )}

          {brief.priorities.length > 0 && (
            <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-accent-muted mb-3">Today's Priorities</p>
              <div className="space-y-2">
                {brief.priorities.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-md bg-bg-secondary px-3 py-2 text-sm">
                    <span className="mt-0.5 font-mono text-xs text-accent-gold">{i + 1}</span>
                    <span className="text-accent-white">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-accent-gold/30 bg-bg-surface/70 p-5">
            <p className="text-sm italic text-accent-gold leading-relaxed">&ldquo;{brief.motivation}&rdquo;</p>
          </div>

          {brief.cached && (
            <p className="text-xs text-accent-muted text-center">
              Showing today's cached brief. It refreshes each morning.
            </p>
          )}
        </motion.div>
      ) : null}
    </FeatureShell>
  );
}
