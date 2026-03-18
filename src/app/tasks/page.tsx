'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar } from '@/hooks/use-week-calendar';
import { createClient } from '@/lib/supabase/client';

type Task = {
  id: string;
  title: string;
  completed: boolean;
  category: string | null;
  priority: string | null;
  due_at: string | null;
};

export default function TasksPage() {
  const tempCounter = useRef(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildDots = useCallback(
    (day: { meals: number; workouts: number; tasks: { pending: number; completed: number } }) => {
      const dots: Array<{ color: string; label: string }> = [];
      if (day.tasks.completed > 0) dots.push({ color: 'bg-emerald-400', label: `${day.tasks.completed} done` });
      if (day.tasks.pending > 0) dots.push({ color: 'bg-amber-400', label: `${day.tasks.pending} pending` });
      return dots;
    },
    []
  );

  const { selectedDate, setSelectedDate, weekOffset, setWeekOffset, activityMap, refresh } =
    useWeekCalendar(buildDots);

  // Fetch tasks for selected day
  useEffect(() => {
    let cancelled = false;
    setFetchLoading(true);
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
        if (!cancelled) {
          setTasks((data ?? []) as Task[]);
          setFetchLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [selectedDate]);

  const addTask = async () => {
    const supabase = createClient();
    if (!title.trim()) return;
    setIsLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      setError('You must be signed in to add tasks.');
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

    const { data, error: insertError } = await supabase
      .from('daily_tasks')
      .insert({ user_id: user.id, title: optimistic.title, category: 'work', priority: 'medium', due_at: dueAt })
      .select('id, title, completed, category, priority, due_at')
      .single();
    setIsLoading(false);
    if (insertError || !data) {
      setTasks((prev) => prev.filter((task) => task.id !== optimistic.id));
      setError(insertError?.message || 'Failed to save task.');
      return;
    }
    setTasks((prev) => [data as Task, ...prev.filter((task) => task.id !== optimistic.id)]);
    refresh();
  };

  const toggleComplete = async (task: Task) => {
    const supabase = createClient();
    const nextValue = !task.completed;
    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: nextValue } : item)));
    const { error: updateError } = await supabase.from('daily_tasks').update({ completed: nextValue }).eq('id', task.id);
    if (updateError) {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: task.completed } : item)));
      setError(updateError.message);
    } else {
      refresh();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTask();
    }
  };

  const dayLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <FeatureShell
      eyebrow="Tasks"
      title="Task & Life OS"
      description="Organize tasks by day. Select a date to view, add, and complete tasks."
    >
      <WeeklyCalendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        activityMap={activityMap}
      />

      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <p className="text-sm font-medium text-accent-white mb-4">
          Tasks for {dayLabel}
        </p>
        <div className="flex gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Add a task for ${dayLabel}...`}
            className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
          <Button
            type="button"
            className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
            onClick={addTask}
            disabled={isLoading}
          >
            Add
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 space-y-2">
          {fetchLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-md bg-bg-secondary" />
            ))
          ) : tasks.length === 0 ? (
            <p className="rounded-md bg-bg-secondary p-3 text-sm text-accent-muted">
              No tasks for this day. Add one above.
            </p>
          ) : (
            tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  task.completed ? 'border-success/50 bg-success/10 text-accent-muted' : 'border-bg-surface bg-bg-secondary text-accent-white'
                }`}
                onClick={() => toggleComplete(task)}
              >
                <div>
                  <span className={task.completed ? 'line-through' : ''}>{task.title}</span>
                  {(task.category || task.priority) && (
                    <span className="ml-2 text-xs uppercase tracking-wider text-accent-muted">
                      {task.category}{task.priority ? ` · ${task.priority}` : ''}
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs uppercase">{task.completed ? 'Done' : 'Open'}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </FeatureShell>
  );
}
