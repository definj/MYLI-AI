'use client';

import { useCallback, useEffect, useState } from 'react';

type ChallengeItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
};

type Summary = {
  appUsageStreak: number;
  challenges: ChallengeItem[];
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
        <div className="flex items-start justify-between gap-6 px-3 py-2.5 sm:px-5">
          <div className="h-9 min-w-0 flex-1 rounded-lg bg-white/10" />
          <div className="h-10 w-14 shrink-0 rounded-2xl bg-white/10" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0D0D0F]/95 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-start justify-between gap-4 px-3 py-2.5 sm:gap-8 sm:px-5 sm:py-3">
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45 sm:text-[10px] sm:tracking-[0.16em]">
            Today&apos;s challenges
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2 sm:mt-2 sm:gap-3">
            {data.challenges.map((c) => (
              <span
                key={c.id}
                className={`inline-flex min-h-[1.75rem] min-w-0 items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[10px] leading-tight sm:min-w-[4.75rem] sm:rounded-xl sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                  c.done
                    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                    : 'border-white/12 bg-white/[0.04] text-white/80'
                }`}
                title={c.detail}
              >
                <span className={`shrink-0 text-[11px] sm:text-xs ${c.done ? 'text-emerald-300' : 'text-white/35'}`}>
                  {c.done ? '✓' : '○'}
                </span>
                <span className="font-medium">{c.label}</span>
              </span>
            ))}
          </div>
        </div>

        <div
          className="flex h-10 shrink-0 items-center justify-center gap-0.5 rounded-2xl border border-orange-400/35 bg-gradient-to-br from-orange-500/25 to-red-500/10 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:h-11 sm:gap-1 sm:px-2.5"
          title="App usage streak"
          role="img"
          aria-label={`${data.appUsageStreak} day app usage streak`}
        >
          <span className="text-base leading-none sm:text-lg" aria-hidden>
            🔥
          </span>
          <span className="text-base font-bold tabular-nums leading-none text-white sm:text-lg">{data.appUsageStreak}</span>
        </div>
      </div>
    </div>
  );
}
