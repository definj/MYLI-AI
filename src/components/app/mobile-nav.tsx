'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '&#9632;' },
  { href: '/meals', label: 'Meals', icon: '&#9675;' },
  { href: '/workouts', label: 'Train', icon: '&#9651;' },
  { href: '/tasks', label: 'Tasks', icon: '&#9744;' },
  { href: '/settings/profile', label: 'Settings', icon: '&#9881;' },
];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname.startsWith('/dashboard');
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-bg-surface bg-bg-primary/95 backdrop-blur-sm sm:hidden">
      <div className="flex items-center justify-around py-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
              isActive(item.href) ? 'text-accent-gold' : 'text-accent-muted'
            }`}
          >
            <span className="text-base" dangerouslySetInnerHTML={{ __html: item.icon }} />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
