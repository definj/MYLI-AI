'use client';

import { useEffect, useState } from 'react';
import { Bell, ChevronRight, LogOut, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export default function SettingsProfilePage() {
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [pushEnabled, setPushEnabled] = useState(true);
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
      const { data: physical } = await supabase
        .from('physical_profiles')
        .select('unit_system')
        .eq('user_id', user.id)
        .maybeSingle();
      if (physical?.unit_system === 'imperial') {
        setUnitSystem('imperial');
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
    await supabase
      .from('physical_profiles')
      .upsert(
        {
          user_id: user.id,
          unit_system: unitSystem,
        },
        { onConflict: 'user_id' }
      );
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
    <main className="min-h-full px-6 pb-24 pt-8 text-white">
      <div className="space-y-5">
        <div className="rounded-[20px] border border-[#A78BFA]/20 bg-gradient-to-br from-[#A78BFA]/12 to-transparent p-4 backdrop-blur-[14px]">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User size={28} className="text-white/80" />
              )}
              <div className="absolute -bottom-1 -right-1 rounded-full border border-[#0D0D0F] bg-gradient-to-tr from-[#A78BFA] to-[#FF6B35] px-2 py-1 text-[10px] font-bold">
                87
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold">{username || 'User'}</h1>
              <p className="text-sm text-[#A78BFA]">Joined {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[18px] border border-[#FF6B35]/20 bg-[#FF6B35]/6 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Subscription</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-lg font-bold">MYLI Pro</p>
            <span className="rounded-[4px] bg-gradient-to-r from-[#A78BFA] to-[#FF6B35] px-2 py-1 text-[10px] uppercase tracking-wider">Active</span>
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/40">Account</p>
          <div className="space-y-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="h-11 border-white/10 bg-black/20 text-white placeholder:text-white/45"
            />
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="Avatar URL"
              className="h-11 border-white/10 bg-black/20 text-white placeholder:text-white/45"
            />
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/40">Physical Stats</p>
          <div className="flex items-center justify-between rounded-[10px] bg-black/30 p-2">
            <span className="text-sm">Unit System</span>
            <div className="flex gap-1 rounded-[8px] bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setUnitSystem('metric')}
                className={`rounded-[6px] px-3 py-1 text-xs font-bold ${unitSystem === 'metric' ? 'bg-white/20 text-white' : 'text-white/40'}`}
              >
                Metric
              </button>
              <button
                type="button"
                onClick={() => setUnitSystem('imperial')}
                className={`rounded-[6px] px-3 py-1 text-xs font-bold ${unitSystem === 'imperial' ? 'bg-white/20 text-white' : 'text-white/40'}`}
              >
                Imperial
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            <div className="flex items-center justify-between rounded-[10px] bg-black/20 px-3 py-2">
              <span>Height</span>
              <span className="flex items-center gap-1">{unitSystem === 'metric' ? '180 cm' : `5'11"`} <ChevronRight size={14} /></span>
            </div>
            <div className="flex items-center justify-between rounded-[10px] bg-black/20 px-3 py-2">
              <span>Weight</span>
              <span className="flex items-center gap-1">{unitSystem === 'metric' ? '75 kg' : '165 lbs'} <ChevronRight size={14} /></span>
            </div>
          </div>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
          <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/40">Settings</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setPushEnabled((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-[10px] bg-black/20 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2"><Bell size={15} /> Push Notifications</span>
              <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${pushEnabled ? 'bg-[#A78BFA]' : 'bg-white/20'}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${pushEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </span>
            </button>
            <button type="button" className="flex w-full items-center justify-between rounded-[10px] bg-black/20 px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Shield size={15} /> Privacy & Data</span>
              <ChevronRight size={14} className="text-white/40" />
            </button>
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-danger' : 'text-success'}`}>{message.text}</p>
        )}
        <Button onClick={save} disabled={isSaving} className="h-12 w-full rounded-[14px] bg-white text-black hover:bg-white/90">
          {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-500/15"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </main>
  );
}
