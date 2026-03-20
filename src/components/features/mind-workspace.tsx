'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar } from '@/hooks/use-week-calendar';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Task = {
  id: string;
  title: string;
  completed: boolean;
  category: string | null;
  priority: string | null;
  due_at: string | null;
};

export function MindWorkspace() {
  const tempCounter = useRef(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [taskLoading, setTaskLoading] = useState(true);
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const buildDots = useCallback(
    (day: { meals: number; workouts: number; tasks: { pending: number; completed: number }; calendar_events: number }) => {
      const dots: Array<{ color: string; label: string }> = [];
      if (day.tasks.completed > 0) dots.push({ color: 'bg-emerald-400', label: `${day.tasks.completed} done` });
      if (day.tasks.pending > 0) dots.push({ color: 'bg-amber-400', label: `${day.tasks.pending} pending` });
      if (day.calendar_events > 0) dots.push({ color: 'bg-violet-400', label: `${day.calendar_events} events` });
      return dots;
    },
    []
  );

  const { selectedDate, setSelectedDate, weekOffset, setWeekOffset, activityMap, refresh } = useWeekCalendar(buildDots);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const startIso = `${selectedDate}T00:00:00.000Z`;
    const endIso = `${selectedDate}T23:59:59.999Z`;

    supabase
      .from('daily_tasks')
      .select('id, title, completed, category, priority, due_at')
      .gte('due_at', startIso)
      .lte('due_at', endIso)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        setTasks((data ?? []) as Task[]);
        setTaskLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const addTask = async () => {
    const supabase = createClient();
    if (!title.trim()) return;
    setSavingTask(true);
    setTaskError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingTask(false);
      setTaskError('You must be signed in to add tasks.');
      return;
    }

    tempCounter.current += 1;
    const dueAt = `${selectedDate}T12:00:00.000Z`;
    const optimistic: Task = {
      id: `tmp-${tempCounter.current}`,
      title: title.trim(),
      completed: false,
      category: 'work',
      priority: 'medium',
      due_at: dueAt,
    };
    setTasks((prev) => [optimistic, ...prev]);
    setTitle('');

    const { data, error } = await supabase
      .from('daily_tasks')
      .insert({ user_id: user.id, title: optimistic.title, category: 'work', priority: 'medium', due_at: dueAt })
      .select('id, title, completed, category, priority, due_at')
      .single();

    setSavingTask(false);
    if (error || !data) {
      setTasks((prev) => prev.filter((task) => task.id !== optimistic.id));
      setTaskError(error?.message || 'Failed to save task.');
      return;
    }
    setTasks((prev) => [data as Task, ...prev.filter((task) => task.id !== optimistic.id)]);
    refresh();
  };

  const toggleComplete = async (task: Task) => {
    const supabase = createClient();
    const nextValue = !task.completed;
    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: nextValue } : item)));
    const { error } = await supabase.from('daily_tasks').update({ completed: nextValue }).eq('id', task.id);
    if (error) {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: task.completed } : item)));
      setTaskError(error.message);
      return;
    }
    refresh();
  };

  const deleteTask = async (taskId: string) => {
    const supabase = createClient();
    const prev = tasks;
    setTasks((current) => current.filter((task) => task.id !== taskId));
    const { error } = await supabase.from('daily_tasks').delete().eq('id', taskId);
    if (error) {
      setTasks(prev);
      setTaskError(error.message);
      return;
    }
    refresh();
  };

  const dayLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const handleDateSelect = (iso: string) => {
    setTaskLoading(true);
    setSelectedDate(iso);
  };

  return (
    <section className="space-y-4 lg:space-y-5">
      <WeeklyCalendar
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        activityMap={activityMap}
        theme="mental"
      />

      <div className="rounded-[16px] border border-[#A78BFA]/25 bg-[#A78BFA]/8 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#D5C7FF]">Mental Task Flow</p>
        <p className="mt-1 text-sm text-white/70">Tasks for {dayLabel}</p>
        <div className="mt-3 flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Add a task for ${dayLabel}...`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTask();
              }
            }}
            className="h-10 border-white/10 bg-black/30 text-white placeholder:text-white/40"
          />
          <Button type="button" onClick={addTask} disabled={savingTask} className="h-10 bg-white text-black">
            Add
          </Button>
        </div>
        {taskError && <p className="mt-2 text-xs text-red-300">{taskError}</p>}

        <div className="mt-3 space-y-2">
          {taskLoading ? (
            [1, 2, 3].map((skeleton) => <div key={skeleton} className="h-10 animate-pulse rounded-md bg-white/5" />)
          ) : tasks.length === 0 ? (
            <p className="rounded-md bg-black/25 p-3 text-sm text-white/55">No tasks on this day yet.</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  task.completed
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-white/60'
                    : 'border-white/10 bg-black/25 text-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleComplete(task)}
                  className="flex flex-1 items-center justify-between text-left"
                >
                  <span className={task.completed ? 'line-through' : ''}>{task.title}</span>
                  <span className="text-xs uppercase">{task.completed ? 'Done' : 'Open'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteTask(task.id)}
                  className="ml-3 rounded-md border border-red-300/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
