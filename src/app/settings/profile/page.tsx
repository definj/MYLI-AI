'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export default function SettingsProfilePage() {
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setUsername(data.username ?? '');
        setAvatarUrl(data.avatar_url ?? '');
      }
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
    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim() || null, avatar_url: avatarUrl.trim() || null })
      .eq('user_id', user.id);
    setIsSaving(false);
    setMessage(error
      ? { type: 'error', text: error.message }
      : { type: 'success', text: 'Profile updated.' });
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign('/');
  };

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-bg-surface" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-accent-muted">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            className="mt-1 h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-accent-muted">Avatar URL</label>
          <Input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
        </div>
        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-danger' : 'text-success'}`}>{message.text}</p>
        )}
        <Button onClick={save} disabled={isSaving} className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90">
          {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>

      <div className="rounded-xl border border-danger/30 bg-bg-surface/70 p-6">
        <p className="text-sm font-medium text-accent-white">Sign Out</p>
        <p className="mt-1 text-sm text-accent-muted">Sign out of your MYLI account on this device.</p>
        <Button onClick={signOut} variant="destructive" className="mt-4">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
