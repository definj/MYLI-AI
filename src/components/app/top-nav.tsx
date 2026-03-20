'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, Dumbbell, Home, Medal, MessageCircle, Settings, Users, Utensils } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/meals', label: 'Meals', icon: Utensils },
  { href: '/workouts', label: 'Body', icon: Dumbbell },
  { href: '/tasks', label: 'Mind', icon: Brain },
  { href: '/coach', label: 'Coach', icon: MessageCircle },
  { href: '/social', label: 'Social', icon: Users },
  { href: '/achievements', label: 'Badges', icon: Medal },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
];

const HIDDEN_ON = ['/', '/onboarding'];

export function TopNav() {
  const pathname = usePathname();

  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="hidden sm:flex lg:hidden items-center gap-1 border-b border-white/10 bg-black/35 px-6 py-2 backdrop-blur-2xl">
      <Link href="/dashboard" className="mr-4 text-lg font-semibold tracking-tight text-accent-gold">
        MYLI
      </Link>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.href === '/dashboard'
          ? pathname.startsWith('/dashboard')
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
              active ? 'bg-white/15 text-accent-white' : 'text-accent-muted hover:bg-white/10 hover:text-accent-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
