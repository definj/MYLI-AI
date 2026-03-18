'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/meals', label: 'Meals' },
  { href: '/workouts', label: 'Workouts' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/coach', label: 'Coach' },
  { href: '/social', label: 'Social' },
  { href: '/achievements', label: 'Badges' },
  { href: '/settings/profile', label: 'Settings' },
];

const HIDDEN_ON = ['/', '/onboarding'];

export function TopNav() {
  const pathname = usePathname();

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="hidden sm:flex items-center gap-1 border-b border-bg-surface bg-bg-primary/95 px-6 py-2 backdrop-blur-sm">
      <Link href="/dashboard" className="mr-4 font-display text-lg tracking-tight text-accent-gold">
        MYLI
      </Link>
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/dashboard'
          ? pathname.startsWith('/dashboard')
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
              active ? 'bg-bg-surface text-accent-white' : 'text-accent-muted hover:text-accent-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
