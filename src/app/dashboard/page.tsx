import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Flame, MessageCircle, Star, Target, Trophy } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/onboarding');
  }

  const todayDate = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { data: profile },
    { data: physical },
    { data: mental },
    { data: brief },
    { count: todayMealsCount },
    { count: workouts7dCount },
    { count: pendingTaskCount },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('track, myli_score, username')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('physical_profiles')
      .select('goal, tdee')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('mental_profiles')
      .select('productivity_style, sleep_avg')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('daily_briefs')
      .select('greeting, body_summary, mind_summary, priorities, motivation')
      .eq('user_id', user.id)
      .eq('brief_date', todayDate)
      .maybeSingle(),
    supabase
      .from('meal_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('logged_at', todayStart.toISOString()),
    supabase
      .from('workout_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('date', sevenDaysAgo.toISOString().slice(0, 10)),
    supabase
      .from('daily_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('completed', false),
  ]);

  const track = profile?.track ?? 'both';
  if (track === 'physical') {
    redirect('/dashboard/body');
  }
  if (track === 'mental') {
    redirect('/dashboard/mind');
  }

  const score = Math.max(0, Math.min(100, profile?.myli_score ?? 0));
  const ringStyle = {
    background: `conic-gradient(var(--accent-gold) ${score * 3.6}deg, rgba(255,255,255,0.14) 0deg)`,
  };
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const authNameRaw =
    (typeof metadata.full_name === 'string' ? metadata.full_name : null) ??
    (typeof metadata.name === 'string' ? metadata.name : null);
  const emailPrefix =
    typeof user.email === 'string' && user.email.includes('@')
      ? user.email.split('@')[0]
      : null;
  const greetingName = (profile?.username?.trim() || authNameRaw?.trim() || emailPrefix?.trim() || 'there');
  const priorities = Array.isArray(brief?.priorities) ? brief.priorities.slice(0, 3) : [];

  return (
    <main className="min-h-full px-6 pb-24 pt-8 text-white">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Good morning, {greetingName}</h1>
            <p className="mt-1 text-xs text-white/45">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.05] shadow-[0_0_20px_rgba(255,255,255,0.05)]">
            <div className="absolute inset-0 rounded-full p-[4px]" style={ringStyle}>
              <div className="h-full w-full rounded-full bg-[#0d0d0f]" />
            </div>
            <span className="relative text-sm font-bold">{score}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-[14px]">
          <div className="absolute right-4 top-4 h-2 w-2 animate-pulse rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">AI Daily Brief</p>
          <p className="mt-2 text-[15px] leading-relaxed text-white/85">
            {brief?.body_summary || 'Your recovery is strong. Prioritize high-focus work first, then training later today.'}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-white/65">
            {brief?.mind_summary || 'Stay consistent with tasks and nutrition to improve score momentum.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[18px] border border-[#FF6B35]/20 bg-white/[0.04] p-4">
            <div className="mb-3 inline-flex rounded-full bg-[#FF6B35]/10 p-2 text-[#FF6B35]">
              <Flame size={18} />
            </div>
            <p className="text-2xl font-bold">{workouts7dCount ?? 0}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Workouts (7d)</p>
          </div>
          <div className="rounded-[18px] border border-[#A78BFA]/20 bg-white/[0.04] p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Recent Badges</p>
            <div className="mt-3 flex gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#A78BFA]/30 bg-[#A78BFA]/20 text-[#A78BFA]"><Star size={14} /></span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#FF6B35]/30 bg-[#FF6B35]/20 text-[#FF6B35]"><Trophy size={14} /></span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/65"><Target size={14} /></span>
            </div>
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Track Snapshot</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Link href="/dashboard/body" className="rounded-[12px] border border-[#FF6B35]/25 bg-[#FF6B35]/8 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#FFC3A0]">Physical</p>
              <p className="mt-1 font-semibold">{todayMealsCount ?? 0} meals</p>
              <p className="text-xs text-white/55">{physical?.goal ?? 'Goal not set'}</p>
            </Link>
            <Link href="/dashboard/mind" className="rounded-[12px] border border-[#A78BFA]/25 bg-[#A78BFA]/8 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[#D5C7FF]">Mental</p>
              <p className="mt-1 font-semibold">{pendingTaskCount ?? 0} open tasks</p>
              <p className="text-xs text-white/55">{mental?.productivity_style ?? 'Style not set'}</p>
            </Link>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/body" className="flex-1 rounded-[12px] border border-white/15 bg-white/5 px-3 py-2 text-center text-xs text-white/80">+ Meal</Link>
          <Link href="/dashboard/body" className="flex-1 rounded-[12px] border border-white/15 bg-white/5 px-3 py-2 text-center text-xs text-white/80">+ Workout</Link>
          <Link href="/dashboard/mind" className="flex-1 rounded-[12px] border border-white/15 bg-white/5 px-3 py-2 text-center text-xs text-white/80">+ Task</Link>
          <Link href="/coach" className="flex-1 rounded-[12px] border border-white/15 bg-white/5 px-3 py-2 text-center text-xs text-white/80">Coach</Link>
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <p className="px-1 text-sm uppercase tracking-[0.15em] text-white/40">Network Activity</p>
          <Link href="/social" className="rounded-[16px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm text-white/85">Community feed and thread activity</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-white/50">
              <span className="flex items-center gap-1"><MessageCircle size={12} /> Open social</span>
              {priorities.length > 0 && <span>{priorities[0]}</span>}
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
