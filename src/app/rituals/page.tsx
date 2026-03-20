'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WeeklyCalendar } from '@/components/app/weekly-calendar';
import { useWeekCalendar } from '@/hooks/use-week-calendar';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type RitualTask = {
  id: string;
  title: string;
  completed: boolean;
  due_at: string | null;
  priority: string | null;
};
const RITUAL_CATEGORY = 'health';

export default function RitualsPage() {
  const tempCounter = useRef(0);
  const [rituals, setRituals] = useState<RitualTask[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

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
      .select('id, title, completed, due_at, priority')
      .eq('category', RITUAL_CATEGORY)
      .gte('due_at', startIso)
      .lte('due_at', endIso)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        setRituals((data ?? []) as RitualTask[]);
        setFetchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const addRitual = async () => {
    const supabase = createClient();
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError('You must be signed in to add rituals.');
      return;
    }

    tempCounter.current += 1;
    const dueAt = `${selectedDate}T12:00:00.000Z`;
    const optimistic: RitualTask = {
      id: `tmp-${tempCounter.current}`,
      title: draft.trim(),
      completed: false,
      priority: 'medium',
      due_at: dueAt,
    };
    setRituals((prev) => [optimistic, ...prev]);
    setDraft('');

    const { data, error: insertError } = await supabase
      .from('daily_tasks')
      .insert({
        user_id: user.id,
        title: optimistic.title,
        category: RITUAL_CATEGORY,
        priority: 'medium',
        due_at: dueAt,
      })
      .select('id, title, completed, due_at, priority')
      .single();

    setSaving(false);
    if (insertError || !data) {
      setRituals((prev) => prev.filter((ritual) => ritual.id !== optimistic.id));
      setError(insertError?.message || 'Failed to save ritual.');
      return;
    }
    setRituals((prev) => [data as RitualTask, ...prev.filter((ritual) => ritual.id !== optimistic.id)]);
    refresh();
  };

  const toggleRitual = async (ritual: RitualTask) => {
    const supabase = createClient();
    const nextValue = !ritual.completed;
    setRituals((prev) => prev.map((item) => (item.id === ritual.id ? { ...item, completed: nextValue } : item)));
    const { error: updateError } = await supabase.from('daily_tasks').update({ completed: nextValue }).eq('id', ritual.id);
    if (updateError) {
      setRituals((prev) => prev.map((item) => (item.id === ritual.id ? { ...item, completed: ritual.completed } : item)));
      setError(updateError.message);
    } else {
      refresh();
    }
  };

  const deleteRitual = async (ritualId: string) => {
    const supabase = createClient();
    const prev = rituals;
    setRituals((current) => current.filter((ritual) => ritual.id !== ritualId));
    const { error: deleteError } = await supabase.from('daily_tasks').delete().eq('id', ritualId);
    if (deleteError) {
      setRituals(prev);
      setError(deleteError.message);
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
    setFetchLoading(true);
    setSelectedDate(iso);
  };

  return (
    <main className="min-h-full px-6 pb-24 pt-8 text-white lg:px-10 lg:pb-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Rituals</p>
          <h1 className="mt-1 text-3xl font-semibold">Daily Rituals Builder</h1>
          <p className="mt-1 text-sm text-white/60">
            Create and track your recurring mental rituals with real account data.
          </p>
        </div>

        <WeeklyCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          weekOffset={weekOffset}
          onWeekChange={setWeekOffset}
          activityMap={activityMap}
          theme="mental"
        />

        <div className="rounded-[16px] border border-[#A78BFA]/25 bg-[#A78BFA]/8 p-6">
          <p className="mb-3 text-sm text-white/75">Rituals for {dayLabel}</p>
        <div className="flex gap-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addRitual();
              }
            }}
            placeholder="Add ritual item for this day..."
            className="h-11 border-white/10 bg-black/30 text-white placeholder:text-white/45"
          />
          <Button
            type="button"
            className="bg-gradient-to-r from-[#7B5EA7] to-[#A78BFA] text-white hover:opacity-90"
            onClick={addRitual}
            disabled={saving}
          >
            {saving ? 'Adding...' : 'Add'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <div className="mt-5 space-y-2">
          {fetchLoading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-11 animate-pulse rounded-md bg-white/10" />)
          ) : rituals.length === 0 ? (
            <p className="rounded-md border border-white/10 bg-black/25 p-3 text-sm text-white/55">
              No rituals for this day yet. Add one above.
            </p>
          ) : (
            rituals.map((ritual) => (
              <div
                key={ritual.id}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  ritual.completed
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-white/65'
                    : 'border-white/10 bg-black/25 text-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleRitual(ritual)}
                  className="flex flex-1 items-center justify-between text-left"
                >
                  <span className={ritual.completed ? 'line-through' : ''}>{ritual.title}</span>
                  <span className="text-xs uppercase">{ritual.completed ? 'Done' : 'Pending'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteRitual(ritual.id)}
                  className="ml-3 rounded-md border border-red-300/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </main>
  );
}
