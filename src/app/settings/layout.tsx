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
  if (pathname === '/settings/profile') {
    return <>{children}</>;
  }

  return (
    <main className="min-h-full bg-transparent px-6 py-8 text-accent-white">
      <div className="mx-auto max-w-[390px]">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/45">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>

        <nav className="mt-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl scrollbar-none" aria-label="Settings navigation">
          {SETTINGS_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-white text-black'
                  : 'bg-black/20 text-white/60 hover:bg-white/10 hover:text-accent-white'
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
