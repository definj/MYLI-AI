'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const SETTINGS_NAV = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/track', label: 'Track' },
  { href: '/settings/units', label: 'Units' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/subscription', label: 'Subscription' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-bg-primary px-4 py-8 text-accent-white sm:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-muted">Settings</p>
        <h1 className="mt-3 font-display text-4xl">Settings</h1>

        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none" aria-label="Settings navigation">
          {SETTINGS_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-accent-gold text-bg-primary'
                  : 'bg-bg-surface text-accent-muted hover:text-accent-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
