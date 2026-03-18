'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

type Track = 'physical' | 'mental' | 'both';

const TRACKS: { value: Track; label: string; description: string }[] = [
  { value: 'physical', label: 'Body', description: 'Nutrition, workouts, and physical metrics.' },
  { value: 'both', label: 'Both', description: 'Full body and mind intelligence.' },
  { value: 'mental', label: 'Mind', description: 'Tasks, rituals, and mental energy.' },
];

export default function SettingsTrackPage() {
  const [track, setTrack] = useState<Track>('both');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('track').eq('user_id', user.id).single();
      if (data?.track) setTrack(data.track as Track);
      setIsLoading(false);
    };
    void load();
  }, []);

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsSaving(false); return; }
    const { error } = await supabase.from('profiles').update({ track }).eq('user_id', user.id);
    setIsSaving(false);
    setMessage(error ? error.message : 'Track updated. Your dashboard will reflect this change.');
  };

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-surface" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {TRACKS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTrack(t.value)}
            className={`rounded-xl border p-5 text-left transition-colors ${
              track === t.value
                ? 'border-accent-gold bg-bg-surface/70'
                : 'border-bg-surface bg-bg-surface/40 hover:border-accent-gold/40'
            }`}
          >
            <p className={`font-medium ${track === t.value ? 'text-accent-gold' : 'text-accent-white'}`}>{t.label}</p>
            <p className="mt-1 text-sm text-accent-muted">{t.description}</p>
          </button>
        ))}
      </div>
      {message && <p className="text-sm text-success">{message}</p>}
      <Button onClick={save} disabled={isSaving} className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90">
        {isSaving ? 'Saving...' : 'Save Track'}
      </Button>
    </div>
  );
}
