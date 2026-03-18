'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { isPushSupported, subscribeToPush, getCurrentSubscription } from '@/lib/push';

type Prefs = {
  mealReminders: boolean;
  workoutReminders: boolean;
  socialAlerts: boolean;
  weeklySummary: boolean;
  coachNudges: boolean;
};

const STORAGE_KEY = 'myli-notification-prefs';

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return defaultPrefs();
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Prefs; } catch { return defaultPrefs(); }
}

function defaultPrefs(): Prefs {
  return { mealReminders: true, workoutReminders: true, socialAlerts: false, weeklySummary: true, coachNudges: true };
}

const LABELS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: 'mealReminders', label: 'Meal Reminders', description: 'Get reminded to log meals at breakfast, lunch, and dinner.' },
  { key: 'workoutReminders', label: 'Workout Reminders', description: 'Daily nudge to complete your scheduled workout.' },
  { key: 'coachNudges', label: 'Coach Nudges', description: 'Periodic check-ins from your AI coach.' },
  { key: 'socialAlerts', label: 'Social Alerts', description: 'Notifications when someone reacts to your posts.' },
  { key: 'weeklySummary', label: 'Weekly Summary', description: 'Email summary of your weekly progress.' },
];

export default function SettingsNotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [saved, setSaved] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (supported) {
      void getCurrentSubscription().then((sub) => setPushEnabled(!!sub));
    }
  }, []);

  const toggle = (key: keyof Prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const togglePush = async () => {
    setPushLoading(true);
    setPushMessage(null);

    if (pushEnabled) {
      const sub = await getCurrentSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setPushEnabled(false);
      setPushMessage('Push notifications disabled.');
    } else {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushLoading(false);
        setPushMessage('Notification permission was denied. Enable it in your browser settings.');
        return;
      }

      const sub = await subscribeToPush();
      if (!sub) {
        setPushLoading(false);
        setPushMessage('Failed to subscribe. VAPID keys may not be configured.');
        return;
      }

      const subJson = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
        }),
      });

      if (res.ok) {
        setPushEnabled(true);
        setPushMessage('Push notifications enabled.');
      } else {
        setPushMessage('Failed to save subscription.');
      }
    }
    setPushLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-accent-white">Push Notifications</p>
            <p className="mt-0.5 text-xs text-accent-muted">
              {pushSupported
                ? 'Receive push notifications for reminders and updates even when MYLI is closed.'
                : 'Push notifications are not supported in this browser.'}
            </p>
          </div>
          <Button
            onClick={togglePush}
            disabled={!pushSupported || pushLoading}
            className={pushEnabled
              ? 'bg-bg-secondary text-accent-muted'
              : 'bg-accent-gold text-bg-primary hover:bg-accent-gold/90'}
          >
            {pushLoading ? 'Working...' : pushEnabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
        {pushMessage && (
          <p className={`mt-2 text-xs ${pushMessage.includes('denied') || pushMessage.includes('Failed') ? 'text-danger' : 'text-success'}`}>
            {pushMessage}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-accent-muted">Notification Types</p>
        {LABELS.map(({ key, label, description }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className="flex w-full items-center justify-between rounded-xl border border-bg-surface bg-bg-surface/70 p-4 text-left transition-colors hover:border-accent-gold/30"
          >
            <div>
              <p className="text-sm font-medium text-accent-white">{label}</p>
              <p className="mt-0.5 text-xs text-accent-muted">{description}</p>
            </div>
            <div className={`h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[key] ? 'bg-accent-gold' : 'bg-bg-secondary'}`}>
              <div className={`h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>
        ))}
      </div>
      {saved && <p className="text-sm text-success">Notification preferences saved.</p>}
      <Button onClick={save} className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90">
        Save Preferences
      </Button>
    </div>
  );
}
