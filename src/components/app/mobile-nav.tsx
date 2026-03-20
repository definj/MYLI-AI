'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, Dumbbell, Home, MessageCircle, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home, color: 'text-white', dot: 'bg-white' },
  { href: '/dashboard/body', label: 'Physical', icon: Dumbbell, color: 'text-[#FF6B35]', dot: 'bg-[#FF6B35]' },
  { href: '/dashboard/mind', label: 'Mental', icon: Brain, color: 'text-[#A78BFA]', dot: 'bg-[#A78BFA]' },
  { href: '/coach', label: 'Coach', icon: MessageCircle, color: 'text-white', dot: 'bg-gradient-to-r from-[#A78BFA] to-[#FF6B35]' },
  { href: '/settings/profile', label: 'Profile', icon: Settings, color: 'text-white', dot: 'bg-white' },
];

const HIDDEN_ON = ['/', '/onboarding'];

export function MobileNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname.startsWith('/dashboard');
    return pathname.startsWith(href);
  };

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-50 h-[80px] border-t border-white/5 bg-white/[0.03] px-6 backdrop-blur-[20px] lg:hidden">
      <div className="flex h-full items-center justify-between">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-col items-center justify-center gap-1.5 px-3 py-2"
          >
            <Icon
              className={`h-6 w-6 transition-all duration-300 ${
                active ? item.color : 'text-white/40'
              }`}
              strokeWidth={active ? 2.5 : 2}
            />
            {active && (
              <span
                className={`absolute -bottom-1 h-1 w-1 rounded-full ${item.dot}`}
              />
            )}
            <span className={`text-[10px] ${active ? 'text-white/70' : 'text-white/35'}`}>
              {item.label}
            </span>
          </Link>
          );
        })}
      </div>
    </nav>
  );
}
