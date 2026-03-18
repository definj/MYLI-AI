'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type UnitSystem = 'metric' | 'imperial';

export default function SettingsUnitsPage() {
  const [units, setUnits] = useState<UnitSystem>(() => {
    if (typeof window === 'undefined') return 'metric';
    return (localStorage.getItem('myli-units') as UnitSystem) ?? 'metric';
  });
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem('myli-units', units);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(['metric', 'imperial'] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => { setUnits(u); setSaved(false); }}
            className={`rounded-xl border p-5 text-left transition-colors ${
              units === u
                ? 'border-accent-gold bg-bg-surface/70'
                : 'border-bg-surface bg-bg-surface/40 hover:border-accent-gold/40'
            }`}
          >
            <p className={`font-medium capitalize ${units === u ? 'text-accent-gold' : 'text-accent-white'}`}>{u}</p>
            <p className="mt-1 text-sm text-accent-muted">
              {u === 'metric' ? 'kg, cm, kcal' : 'lbs, ft/in, kcal'}
            </p>
          </button>
        ))}
      </div>
      {saved && <p className="text-sm text-success">Units preference saved.</p>}
      <Button onClick={save} className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90">
        Save Units
      </Button>
    </div>
  );
}
