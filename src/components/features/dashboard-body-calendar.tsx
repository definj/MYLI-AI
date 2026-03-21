'use client';

import { useCallback } from 'react';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar, type CalendarDayData } from '@/hooks/use-week-calendar';

export function DashboardBodyCalendar() {
  const buildDots = useCallback(
    (day: CalendarDayData) => {
      const dots: Array<{ color: string; label: string }> = [];
      if (day.planned_workout) {
        const p = day.planned_workout;
        dots.push({
          color: p.completed ? 'bg-emerald-300/80' : 'bg-[#FF9A5C]',
          label: `${p.completed ? '✓ ' : ''}${p.workout_type || p.title}`,
        });
      }
      if (day.meals > 0) dots.push({ color: 'bg-emerald-400', label: `${day.meals} meal${day.meals > 1 ? 's' : ''}` });
      if (day.workouts > 0) dots.push({ color: 'bg-blue-400', label: `${day.workouts} workout${day.workouts > 1 ? 's' : ''}` });
      if (day.calendar_events > 0) dots.push({ color: 'bg-violet-400', label: `${day.calendar_events} calendar event${day.calendar_events > 1 ? 's' : ''}` });
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
