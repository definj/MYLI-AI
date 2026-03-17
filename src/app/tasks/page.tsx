import { FeatureShell } from '@/components/app/feature-shell';
import { createClient } from '@/lib/supabase/server';
import { TasksClient, type Task } from '@/components/features/tasks-client';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('daily_tasks')
    .select('id, title, completed, category, priority')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(50);

  return (
    <FeatureShell
      eyebrow="Tasks"
      title="Task & Life OS"
      description="Kanban/list-ready task management with optimistic updates and category-ready task objects."
    >
      <TasksClient initialTasks={(data ?? []) as Task[]} />
    </FeatureShell>
  );
}
