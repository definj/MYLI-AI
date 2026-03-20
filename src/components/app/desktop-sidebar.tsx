'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Dumbbell,
  Home,
  MessageCircle,
  Settings,
  Target,
  Trophy,
  Users,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard', label: 'Home', icon: Home },
      { href: '/dashboard/body', label: 'Physical', icon: Dumbbell },
      { href: '/dashboard/mind', label: 'Mental', icon: Target },
      { href: '/coach', label: 'AI Coach', icon: MessageCircle },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/social', label: 'Social', icon: Users },
      { href: '/achievements', label: 'Badges', icon: Trophy },
      { href: '/settings/profile', label: 'Settings', icon: Settings },
    ],
  },
];

const HIDDEN_ON = ['/', '/onboarding'];

export function DesktopSidebar() {
  const pathname = usePathname();

  if (HIDDEN_ON.includes(pathname)) return null;

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/10 bg-black/25 p-5 backdrop-blur-2xl lg:block">
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">MYLI</p>
        <h2 className="mt-2 text-lg font-semibold text-white">Lifestyle Intelligence</h2>
        <p className="mt-1 text-xs text-white/60">Desktop workspace</p>
      </div>

      <nav className="space-y-6" aria-label="Desktop navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-2 text-[10px] uppercase tracking-[0.22em] text-white/45">{section.label}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-white/15 text-white'
                        : 'text-white/65 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
