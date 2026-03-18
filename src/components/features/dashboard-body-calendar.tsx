'use client';

import { useCallback } from 'react';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar } from '@/hooks/use-week-calendar';

export function DashboardBodyCalendar() {
  const buildDots = useCallback(
    (day: { meals: number; workouts: number; tasks: { pending: number; completed: number } }) => {
      const dots: Array<{ color: string; label: string }> = [];
      if (day.meals > 0) dots.push({ color: 'bg-emerald-400', label: `${day.meals} meal${day.meals > 1 ? 's' : ''}` });
      if (day.workouts > 0) dots.push({ color: 'bg-blue-400', label: `${day.workouts} workout${day.workouts > 1 ? 's' : ''}` });
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
