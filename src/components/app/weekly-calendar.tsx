'use client';

import { useCallback, useMemo } from 'react';

export type ActivityDot = { color: string; label: string };
export type ActivityMap = Record<string, { dots: ActivityDot[] }>;

type Props = {
  selectedDate: string;
  onDateSelect: (iso: string) => void;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  activityMap?: ActivityMap;
};

function toIso(d: Date) {
  return d.toISOString().split('T')[0];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeeklyCalendar({
  selectedDate,
  onDateSelect,
  weekOffset,
  onWeekChange,
  activityMap = {},
}: Props) {
  const today = useMemo(() => toIso(new Date()), []);

  const weekDays = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayOffset + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { iso: toIso(d), dayNum: d.getDate(), dayLabel: DAY_LABELS[i] };
    });
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    if (!weekDays.length) return '';
    const start = weekDays[0];
    const end = weekDays[6];
    const startDate = new Date(start.iso);
    const endDate = new Date(end.iso);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }, [weekDays]);

  const goBack = useCallback(() => onWeekChange(weekOffset - 1), [weekOffset, onWeekChange]);
  const goForward = useCallback(() => onWeekChange(weekOffset + 1), [weekOffset, onWeekChange]);
  const goToday = useCallback(() => {
    onWeekChange(0);
    onDateSelect(toIso(new Date()));
  }, [onWeekChange, onDateSelect]);

  return (
    <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goBack}
          className="rounded-md px-2 py-1 text-accent-muted hover:text-accent-white transition-colors"
          aria-label="Previous week"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goToday}
          className="text-xs font-mono uppercase tracking-widest text-accent-muted hover:text-accent-white transition-colors"
        >
          {weekLabel}
        </button>
        <button
          type="button"
          onClick={goForward}
          className="rounded-md px-2 py-1 text-accent-muted hover:text-accent-white transition-colors"
          aria-label="Next week"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map(({ iso, dayNum, dayLabel }) => {
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const dots = activityMap[iso]?.dots ?? [];

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onDateSelect(iso)}
              className={`flex flex-col items-center rounded-lg py-2 transition-colors ${
                isSelected
                  ? 'bg-accent-gold text-bg-primary'
                  : isToday
                    ? 'ring-1 ring-accent-gold text-accent-white'
                    : 'text-accent-muted hover:text-accent-white hover:bg-bg-secondary'
              }`}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider">{dayLabel}</span>
              <span className="mt-0.5 text-sm font-medium">{dayNum}</span>
              {dots.length > 0 && (
                <div className="mt-1 flex gap-0.5">
                  {dots.slice(0, 3).map((dot, i) => (
                    <span
                      key={`${dot.label}-${i}`}
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-bg-primary/60' : dot.color}`}
                      title={dot.label}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
