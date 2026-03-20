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
  theme?: 'default' | 'physical' | 'mental';
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
  theme = 'default',
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

  const palette =
    theme === 'physical'
      ? {
          card: 'rounded-[16px] border border-[#FF6B35]/25 bg-[#FF6B35]/8',
          buttonText: 'text-white/55 hover:text-white',
          label: 'text-[#FFC3A0]',
          selected: 'bg-gradient-to-r from-[#FF6B35] to-[#FF9A5C] text-white',
          today: 'ring-1 ring-[#FF9A5C] text-white',
          idle: 'text-white/60 hover:text-white hover:bg-white/10',
          selectedDot: 'bg-white/70',
        }
      : theme === 'mental'
        ? {
            card: 'rounded-[16px] border border-[#A78BFA]/25 bg-[#A78BFA]/8',
            buttonText: 'text-white/55 hover:text-white',
            label: 'text-[#D5C7FF]',
            selected: 'bg-gradient-to-r from-[#7B5EA7] to-[#A78BFA] text-white',
            today: 'ring-1 ring-[#A78BFA] text-white',
            idle: 'text-white/60 hover:text-white hover:bg-white/10',
            selectedDot: 'bg-white/70',
          }
        : {
            card: 'glass-card rounded-2xl',
            buttonText: 'text-accent-muted hover:text-accent-white',
            label: 'text-accent-muted',
            selected: 'bg-accent-gold text-bg-primary',
            today: 'ring-1 ring-accent-gold text-accent-white',
            idle: 'text-accent-muted hover:text-accent-white hover:bg-bg-secondary',
            selectedDot: 'bg-bg-primary/60',
          };

  return (
    <div className={`${palette.card} p-3 sm:p-4`}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goBack}
          className={`rounded-md px-2 py-1 transition-colors ${palette.buttonText}`}
          aria-label="Previous week"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={goToday}
          className={`text-xs font-mono uppercase tracking-widest transition-colors ${palette.label}`}
        >
          {weekLabel}
        </button>
        <button
          type="button"
          onClick={goForward}
          className={`rounded-md px-2 py-1 transition-colors ${palette.buttonText}`}
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
                  ? palette.selected
                  : isToday
                    ? palette.today
                    : palette.idle
              }`}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider">{dayLabel}</span>
              <span className="mt-0.5 text-sm font-medium">{dayNum}</span>
              {dots.length > 0 && (
                <div className="mt-1 flex gap-0.5">
                  {dots.slice(0, 3).map((dot, i) => (
                    <span
                      key={`${dot.label}-${i}`}
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? palette.selectedDot : dot.color}`}
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
