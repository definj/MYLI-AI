'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  category: string | null;
  priority: string | null;
};

export function TasksClient({ initialTasks }: { initialTasks: Task[] }) {
  const tempCounter = useRef(0);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const optimistic: Task = {
      id: `tmp-${tempCounter.current}`,
      title: title.trim(),
      completed: false,
      category: 'work',
      priority: 'medium',
    };
    setTasks((prev) => [optimistic, ...prev]);
    setTitle('');

    const { data, error: insertError } = await supabase
      .from('daily_tasks')
      .insert({ user_id: user.id, title: optimistic.title, category: 'work', priority: 'medium' })
      .select('id, title, completed, category, priority')
      .single();
    setIsLoading(false);
    if (insertError || !data) {
      setTasks((prev) => prev.filter((task) => task.id !== optimistic.id));
      setError(insertError?.message || 'Failed to save task.');
      return;
    }
    setTasks((prev) => [data as Task, ...prev.filter((task) => task.id !== optimistic.id)]);
  };

  const toggleComplete = async (task: Task) => {
    const supabase = createClient();
    const nextValue = !task.completed;
    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: nextValue } : item)));
    const { error: updateError } = await supabase.from('daily_tasks').update({ completed: nextValue }).eq('id', task.id);
    if (updateError) {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, completed: task.completed } : item)));
      setError(updateError.message);
    }
  };

  return (
    <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
      <div className="flex gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task..."
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
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
              task.completed ? 'border-success/50 bg-success/10 text-accent-muted' : 'border-bg-surface bg-bg-secondary text-accent-white'
            }`}
            onClick={() => toggleComplete(task)}
          >
            <span>{task.title}</span>
            <span className="font-mono text-xs uppercase">{task.completed ? 'Done' : 'Open'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
