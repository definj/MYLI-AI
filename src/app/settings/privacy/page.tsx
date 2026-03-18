'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPrivacyPage() {
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>('public');
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const exportData = async () => {
    setIsExporting(true);
    setExportMessage(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsExporting(false); return; }

    const [{ data: profile }, { data: physical }, { data: mental }, { data: meals }, { data: tasks }, { data: streaks }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('physical_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('mental_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('meal_logs').select('*').eq('user_id', user.id),
        supabase.from('daily_tasks').select('*').eq('user_id', user.id),
        supabase.from('streaks').select('*').eq('user_id', user.id),
      ]);

    const blob = new Blob([JSON.stringify({ profile, physical, mental, meals, tasks, streaks }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myli-data-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
    setExportMessage('Your data has been downloaded.');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-accent-white">Profile Visibility</p>
          <p className="mt-1 text-xs text-accent-muted">Control whether your profile and activity are visible to other users.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(['public', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setProfileVisibility(v)}
              className={`rounded-lg border p-3 text-sm capitalize transition-colors ${
                profileVisibility === v
                  ? 'border-accent-gold bg-bg-secondary text-accent-gold'
                  : 'border-bg-surface bg-bg-secondary text-accent-muted hover:text-accent-white'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6 space-y-3">
        <p className="text-sm font-medium text-accent-white">Export Your Data</p>
        <p className="text-xs text-accent-muted">Download a JSON file containing all your MYLI data: profile, meals, tasks, streaks, and more.</p>
        {exportMessage && <p className="text-sm text-success">{exportMessage}</p>}
        <Button onClick={exportData} disabled={isExporting} className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90">
          {isExporting ? 'Exporting...' : 'Download My Data'}
        </Button>
      </div>

      <div className="rounded-xl border border-danger/30 bg-bg-surface/70 p-6 space-y-3">
        <p className="text-sm font-medium text-accent-white">Delete Account</p>
        <p className="text-xs text-accent-muted">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        {!deleteConfirm ? (
          <Button onClick={() => setDeleteConfirm(true)} variant="destructive">
            Request Account Deletion
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-danger">Are you sure? This will permanently delete all your data.</p>
            <div className="flex gap-3">
              <Button onClick={() => setDeleteConfirm(false)} variant="outline" className="border-bg-surface text-accent-muted hover:text-accent-white">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  window.location.assign('/?deleted=true');
                }}
              >
                Confirm Deletion
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
