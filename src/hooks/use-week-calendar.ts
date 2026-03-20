'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ActivityMap } from '@/components/app/weekly-calendar';

type DayData = {
  meals: number;
  workouts: number;
  tasks: { pending: number; completed: number };
  calendar_events: number;
};

type CalendarApiResponse = { data: Record<string, DayData> };

type DotBuilder = (day: DayData) => Array<{ color: string; label: string }>;

function toIso(d: Date) {
  return d.toISOString().split('T')[0];
}

function getWeekRange(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toIso(monday), end: toIso(sunday) };
}

export function useWeekCalendar(buildDots: DotBuilder) {
  const [selectedDate, setSelectedDate] = useState(toIso(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [rawData, setRawData] = useState<Record<string, DayData>>({});

  const { start, end } = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/calendar/week?start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: CalendarApiResponse | null) => {
        if (!cancelled && json?.data) setRawData(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [start, end]);

  const activityMap: ActivityMap = useMemo(() => {
    const result: ActivityMap = {};
    for (const [date, day] of Object.entries(rawData)) {
      const dots = buildDots(day);
      if (dots.length > 0) result[date] = { dots };
    }
    return result;
  }, [rawData, buildDots]);

  const refresh = useCallback(() => {
    fetch(`/api/calendar/week?start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: CalendarApiResponse | null) => {
        if (json?.data) setRawData(json.data);
      })
      .catch(() => {});
  }, [start, end]);

  return {
    selectedDate,
    setSelectedDate,
    weekOffset,
    setWeekOffset,
    activityMap,
    rawData,
    refresh,
  };
}
