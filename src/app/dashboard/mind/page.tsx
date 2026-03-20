import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, Circle, CircleCheck, Coffee, Moon, Plus, Zap } from 'lucide-react';
import { MindWorkspace } from '@/components/features/mind-workspace';
const RITUAL_CATEGORY = 'health';

export const dynamic = 'force-dynamic';

export default async function MindDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/onboarding');

  const nowIso = new Date().toISOString();
  const todayDate = new Date().toISOString().split('T')[0];
  const todayStartIso = `${todayDate}T00:00:00.000Z`;
  const todayEndIso = `${todayDate}T23:59:59.999Z`;

  const [{ data: mental }, { data: tasks }, { data: ritualTasks }, { data: latestVitamin }, { data: todayBrief }] =
    await Promise.all([
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
        .from('daily_tasks')
        .select('id, title, completed, due_at')
        .eq('user_id', user.id)
        .eq('category', RITUAL_CATEGORY)
        .gte('due_at', todayStartIso)
        .lte('due_at', todayEndIso)
        .order('due_at', { ascending: true, nullsFirst: false })
        .limit(6),
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
  const ritualItems = (ritualTasks ?? []).slice(0, 3).map((ritual) => {
    const label = ritual.title.toLowerCase();
    const icon = label.includes('work') ? Zap : label.includes('evening') || label.includes('night') ? Moon : Coffee;
    const time = ritual.due_at
      ? new Date(ritual.due_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : 'Anytime';
    return {
      id: ritual.id,
      label: ritual.title,
      time,
      done: ritual.completed,
      icon,
    };
  });

  return (
    <main className="min-h-full px-6 pb-24 pt-8 text-white lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Mind</p>
            <h1 className="mt-1 text-3xl font-semibold">Mental</h1>
          </div>
          <p className="text-xs text-white/45">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>

        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Track Snapshot</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Link href="/dashboard/body" className="rounded-[12px] border border-[#FF6B35]/25 bg-[#FF6B35]/8 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#FFC3A0]">Physical</p>
              <p className="mt-1 font-semibold">Open body hub</p>
              <p className="text-xs text-white/55">Meals, workouts, macros</p>
            </Link>
            <Link href="/dashboard/mind" className="rounded-[12px] border border-[#A78BFA]/25 bg-[#A78BFA]/8 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#D5C7FF]">Mental</p>
              <p className="mt-1 font-semibold">{openTaskCount} open tasks</p>
              <p className="text-xs text-white/55">{mental?.productivity_style ?? 'Style not set'}</p>
            </Link>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#A78BFA]/25 bg-white/[0.06] p-5 backdrop-blur-[14px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Daily Rituals</p>
            <Link href="/rituals" className="text-xs text-[#D5C7FF] hover:text-white">
              Manage
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {ritualItems.length === 0 ? (
              <Link
                href="/rituals"
                className="flex items-center justify-between rounded-[12px] border border-[#A78BFA]/15 bg-black/20 p-3 text-sm text-white/65"
              >
                <span>No rituals scheduled for today. Add your first ritual.</span>
                <Plus size={16} className="text-[#A78BFA]" />
              </Link>
            ) : (
              ritualItems.map((ritual) => {
              const Icon = ritual.icon;
              return (
                <Link
                  key={ritual.id}
                  href="/rituals"
                  className="flex items-center justify-between rounded-[12px] border border-[#A78BFA]/15 bg-black/20 p-3 transition-colors hover:bg-black/35"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ritual.done ? 'bg-[#A78BFA]/20 text-[#A78BFA]' : 'bg-white/5 text-white/40'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className={`text-[15px] ${ritual.done ? 'text-white/75 line-through' : 'text-white'}`}>{ritual.label}</p>
                      <p className="text-xs text-white/40">{ritual.time}</p>
                    </div>
                  </div>
                  {ritual.done ? <CircleCheck size={22} className="text-[#A78BFA]" /> : <Circle size={22} className="text-white/25" />}
                </Link>
              );
            })
            )}
          </div>
          <p className="mt-2 text-xs text-white/45">
            {ritualItems.length > 0
              ? `${ritualItems.filter((item) => item.done).length}/${ritualItems.length} rituals completed today`
              : 'Ritual completion contributes to your consistency streak'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[16px] border border-[#A78BFA]/30 bg-gradient-to-br from-[#A78BFA]/12 to-transparent p-3">
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-[#A78BFA]" />
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#A78BFA]">Do First</p>
            </div>
            <ul className="mt-2 space-y-1 text-[13px] text-white/80">
              {topTasks.slice(0, 2).map((task) => (
                <li key={task.id}>• {task.title}</li>
              ))}
              {topTasks.length === 0 && <li className="text-white/45">No urgent tasks</li>}
            </ul>
          </div>
          <div className="rounded-[16px] border border-white/20 bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-white/60" />
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Schedule</p>
            </div>
            <ul className="mt-2 space-y-1 text-[13px] text-white/70">
              <li>• {mental?.productivity_style || 'Deep work block'}</li>
              <li>• Sleep avg {mental?.sleep_avg ?? '--'} h</li>
            </ul>
          </div>
          <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Delegate</p>
            <p className="mt-2 text-[13px] text-white/60">{openTaskCount > 3 ? 'Review low-priority tasks' : 'Nothing to delegate'}</p>
          </div>
          <div className="rounded-[16px] border border-white/10 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Eliminate</p>
            <p className="mt-2 text-[13px] italic text-white/35">No blockers today</p>
          </div>
        </div>

        {todayBrief && (
          <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-white/70">{todayBrief.greeting}</p>
            <p className="mt-1 text-sm italic text-[#A78BFA]">{todayBrief.motivation}</p>
            <p className="mt-2 text-xs text-white/45">
              Latest vitamin insight: {latestVitamin?.generated_at ? new Date(latestVitamin.generated_at).toLocaleDateString() : 'Pending'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/coach" className="rounded-[12px] bg-white px-4 py-3 text-center text-sm font-bold text-black">Open Coach</Link>
          <Link href="/rituals" className="rounded-[12px] border border-white/15 bg-white/5 px-4 py-3 text-center text-sm text-white/80">Open Rituals</Link>
        </div>

        <MindWorkspace />
      </div>
    </main>
  );
}
