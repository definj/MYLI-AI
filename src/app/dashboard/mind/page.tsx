import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MindDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/onboarding');

  const nowIso = new Date().toISOString();
  const todayDate = new Date().toISOString().split('T')[0];

  const [{ data: profile }, { data: mental }, { data: tasks }, { data: ritualsStreak }, { data: latestVitamin }, { data: todayBrief }] =
    await Promise.all([
      supabase.from('profiles').select('myli_score, track').eq('user_id', user.id).single(),
      supabase
        .from('mental_profiles')
        .select('stress_sources, sleep_avg, productivity_style, life_areas')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('daily_tasks')
        .select('id, title, completed, due_at, category, priority')
        .eq('user_id', user.id)
        .or(`due_at.is.null,due_at.gte.${nowIso}`)
        .order('due_at', { ascending: true, nullsFirst: true })
        .limit(8),
      supabase
        .from('streaks')
        .select('current_count, longest_count')
        .eq('user_id', user.id)
        .eq('streak_type', 'journal')
        .maybeSingle(),
      supabase
        .from('vitamin_analysis')
        .select('generated_at')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('daily_briefs')
        .select('greeting, motivation')
        .eq('user_id', user.id)
        .eq('brief_date', todayDate)
        .maybeSingle(),
    ]);

  const topTasks = (tasks ?? []).slice(0, 3);
  const openTaskCount = (tasks ?? []).filter((t) => !t.completed).length;
  const completeTaskCount = (tasks ?? []).filter((t) => t.completed).length;

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-8 text-accent-white sm:px-10 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-muted">Dashboard / Mind</p>
          <h1 className="mt-3 font-display text-4xl">Mental Track Dashboard</h1>
          <p className="mt-2 text-accent-muted">
            Focus planning, task execution, and mental energy markers in one daily view.
          </p>
        </div>

        {todayBrief ? (
          <Link href="/brief" className="block rounded-xl border border-accent-gold/20 bg-bg-surface/70 p-4 transition-colors hover:border-accent-gold/40">
            <p className="text-sm text-accent-white">{todayBrief.greeting}</p>
            <p className="mt-1 text-xs italic text-accent-gold">&ldquo;{todayBrief.motivation}&rdquo;</p>
          </Link>
        ) : (
          <Link href="/brief" className="block rounded-xl border border-bg-surface bg-bg-surface/40 p-4 transition-colors hover:border-accent-gold/30">
            <p className="text-sm text-accent-muted">Your daily brief is ready. Tap to generate today's personalized summary.</p>
          </Link>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">MYLI Score</p>
            <p className="mt-2 font-display text-4xl text-accent-gold">{profile?.myli_score ?? 0}</p>
            <p className="mt-2 text-sm text-accent-muted">Daily score includes consistency and task completion.</p>
          </div>
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Task Flow</p>
            <p className="mt-2 font-display text-4xl">{openTaskCount}</p>
            <p className="mt-2 text-sm text-accent-muted">
              Open tasks ({completeTaskCount} completed in current list)
            </p>
          </div>
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-muted">Reflection Streak</p>
            <p className="mt-2 font-display text-4xl">{ritualsStreak?.current_count ?? 0}</p>
            <p className="mt-2 text-sm text-accent-muted">
              Longest streak: {ritualsStreak?.longest_count ?? 0}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-accent-white">Today Focus (Top 3)</p>
              <Link href="/tasks" className="text-xs uppercase tracking-[0.2em] text-accent-gold hover:opacity-80">
                Open Tasks
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {topTasks.length === 0 && (
                <p className="rounded-md bg-bg-secondary p-3 text-sm text-accent-muted">
                  No tasks yet. Add your top priorities in Tasks.
                </p>
              )}
              {topTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md bg-bg-secondary p-3 text-sm"
                >
                  <div>
                    <p className={task.completed ? 'line-through text-accent-muted' : 'text-accent-white'}>{task.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.15em] text-accent-muted">
                      {task.category ?? 'general'} {task.priority ? `- ${task.priority}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-xs uppercase text-accent-muted">
                    {task.completed ? 'done' : 'open'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
            <p className="text-sm font-medium text-accent-white">Mental Profile Snapshot</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-bg-secondary p-3">
                <p className="text-accent-muted">Sleep Avg</p>
                <p className="mt-1">{mental?.sleep_avg ?? '--'} h</p>
              </div>
              <div className="rounded-md bg-bg-secondary p-3">
                <p className="text-accent-muted">Productivity Style</p>
                <p className="mt-1">{mental?.productivity_style ?? 'Not set'}</p>
              </div>
              <div className="rounded-md bg-bg-secondary p-3 col-span-2">
                <p className="text-accent-muted">Life Areas</p>
                <p className="mt-1">
                  {mental?.life_areas?.length ? mental.life_areas.join(', ') : 'Not set'}
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-md border border-bg-surface bg-bg-secondary p-3 text-sm text-accent-muted">
              Latest vitamin insight:{' '}
              {latestVitamin?.generated_at
                ? new Date(latestVitamin.generated_at).toLocaleString()
                : 'No report yet'}
            </div>
            <div className="mt-4 flex gap-2">
              <Link
                href="/coach"
                className="inline-flex rounded-md bg-accent-gold px-4 py-2 text-sm font-medium text-bg-primary hover:bg-accent-gold/90"
              >
                Open Coach
              </Link>
              <Link
                href="/rituals"
                className="inline-flex rounded-md border border-bg-surface bg-bg-secondary px-4 py-2 text-sm text-accent-white hover:bg-bg-primary"
              >
                Open Rituals
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
