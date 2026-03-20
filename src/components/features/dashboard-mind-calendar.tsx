'use client';

import { useCallback } from 'react';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar } from '@/hooks/use-week-calendar';

export function DashboardMindCalendar() {
  const buildDots = useCallback(
    (day: { meals: number; workouts: number; tasks: { pending: number; completed: number }; calendar_events: number }) => {
      const dots: Array<{ color: string; label: string }> = [];
      if (day.tasks.completed > 0) dots.push({ color: 'bg-emerald-400', label: `${day.tasks.completed} done` });
      if (day.tasks.pending > 0) dots.push({ color: 'bg-amber-400', label: `${day.tasks.pending} pending` });
      if (day.calendar_events > 0) dots.push({ color: 'bg-violet-400', label: `${day.calendar_events} event${day.calendar_events > 1 ? 's' : ''}` });
      return dots;
    },
    []
  );

  const { selectedDate, setSelectedDate, weekOffset, setWeekOffset, activityMap } =
    useWeekCalendar(buildDots);

  return (
    <WeeklyCalendar
      selectedDate={selectedDate}
      onDateSelect={setSelectedDate}
      weekOffset={weekOffset}
      onWeekChange={setWeekOffset}
      activityMap={activityMap}
    />
  );
}
