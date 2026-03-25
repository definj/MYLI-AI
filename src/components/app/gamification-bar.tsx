'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, Target, Trophy } from 'lucide-react';

type StreakItem = {
  type: string;
  label: string;
  current: number;
  longest: number;
  lastDate: string | null;
};

type ChallengeItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
};

type Summary = {
  streaks: StreakItem[];
  challenges: ChallengeItem[];
  myliScore: number;
};

export function GamificationBar() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/gamification/summary');
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = (await res.json()) as Summary;
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  if (loading && !data) {
    return (
      <div
        className="sticky top-0 z-30 border-b border-white/10 bg-[#0D0D0F]/95 backdrop-blur-md"
        aria-hidden
      >
        <div className="flex animate-pulse gap-2 px-3 py-2.5 sm:px-4">
          <div className="h-8 flex-1 rounded-lg bg-white/10" />
          <div className="h-8 w-20 rounded-lg bg-white/10" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0D0D0F]/95 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-[#FF6B35]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#FFC3A0]">
              <Flame className="h-3 w-3 text-[#FF9A5C]" aria-hidden />
              Streaks
            </span>
            <div className="flex min-w-0 gap-1 overflow-x-auto scrollbar-none [-webkit-overflow-scrolling:touch]">
              {data.streaks.map((s) => (
                <span
                  key={s.type}
                  className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/90"
                  title={`${s.label}: best ${s.longest}`}
                >
                  <span className="text-white/50">{s.label}</span>{' '}
                  <span className="font-semibold tabular-nums text-white">{s.current}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-100"
              title="MYLI score"
            >
              <Target className="h-3 w-3" aria-hidden />
              {data.myliScore}
            </span>
            <Link
              href="/achievements"
              className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80 transition-colors hover:bg-white/10"
            >
              <Trophy className="h-3 w-3 text-amber-200/90" aria-hidden />
              Badges
            </Link>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/5 pt-2">
          <span className="w-full text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Today&apos;s challenges
          </span>
          {data.challenges.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${
                c.done
                  ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                  : 'border-white/12 bg-white/[0.04] text-white/75'
              }`}
              title={c.detail}
            >
              <span className={c.done ? 'text-emerald-300' : 'text-white/35'}>{c.done ? '✓' : '○'}</span>
              <span className="font-medium">{c.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
