'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, Trophy } from 'lucide-react';

type ChallengeItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
};

type Summary = {
  appUsageStreak: number;
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
        <div className="flex animate-pulse gap-4 px-4 py-3 sm:px-5">
          <div className="h-10 flex-1 rounded-lg bg-white/10" />
          <div className="h-10 w-10 shrink-0 rounded-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0D0D0F]/95 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-5">
        <div className="min-w-0 sm:max-w-[min(100%,520px)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">Today&apos;s challenges</p>
          <div className="mt-2 flex flex-wrap gap-3 sm:gap-4">
            {data.challenges.map((c) => (
              <span
                key={c.id}
                className={`inline-flex min-w-[5.5rem] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-[12px] ${
                  c.done
                    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/12 bg-white/[0.04] text-white/80'
                }`}
                title={c.detail}
              >
                <span className={`shrink-0 text-sm ${c.done ? 'text-emerald-300' : 'text-white/35'}`}>
                  {c.done ? '✓' : '○'}
                </span>
                <span className="font-medium">{c.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-start gap-4 sm:ml-auto sm:justify-end sm:gap-5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-amber-100"
            title="MYLI score"
          >
            <Target className="h-3.5 w-3.5" aria-hidden />
            {data.myliScore}
          </span>
          <Link
            href="/achievements"
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/80 transition-colors hover:bg-white/10"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-200/90" aria-hidden />
            Badges
          </Link>

          <div
            className="flex h-11 min-w-[3.25rem] items-center justify-center gap-1 rounded-2xl border border-orange-400/35 bg-gradient-to-br from-orange-500/25 to-red-500/10 px-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            title="App usage streak"
            role="img"
            aria-label={`${data.appUsageStreak} day app usage streak`}
          >
            <span className="text-lg leading-none" aria-hidden>
              🔥
            </span>
            <span className="text-lg font-bold tabular-nums leading-none text-white">{data.appUsageStreak}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
