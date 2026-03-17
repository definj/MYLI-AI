'use client';

import { useEffect, useState } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Ritual = { id: string; label: string; done: boolean };

const STORAGE_KEY = 'myli-rituals';

export default function RitualsPage() {
  const [rituals, setRituals] = useState<Ritual[]>(() => {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as Ritual[];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState('');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rituals));
  }, [rituals]);

  const addRitual = () => {
    if (!draft.trim()) return;
    setRituals((prev) => [...prev, { id: String(Date.now()), label: draft.trim(), done: false }]);
    setDraft('');
  };

  return (
    <FeatureShell
      eyebrow="Rituals"
      title="Daily Rituals Builder"
      description="Create and track morning/evening rituals with daily completion toggles."
    >
      <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
        <div className="flex gap-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add ritual item..."
            className="h-11 bg-bg-secondary border-none text-accent-white placeholder:text-accent-muted"
          />
          <Button
            type="button"
            className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
            onClick={addRitual}
          >
            Add
          </Button>
        </div>
        <div className="mt-5 space-y-2">
          {rituals.map((ritual) => (
            <button
              key={ritual.id}
              type="button"
              onClick={() =>
                setRituals((prev) =>
                  prev.map((item) => (item.id === ritual.id ? { ...item, done: !item.done } : item))
                )
              }
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                ritual.done ? 'border-success/50 bg-success/10 text-accent-muted' : 'border-bg-surface bg-bg-secondary text-accent-white'
              }`}
            >
              <span>{ritual.label}</span>
              <span className="font-mono text-xs uppercase">{ritual.done ? 'Done' : 'Pending'}</span>
            </button>
          ))}
        </div>
      </div>
    </FeatureShell>
  );
}
