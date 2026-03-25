'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MobileNav } from '@/components/app/mobile-nav';
import { GamificationBar } from '@/components/app/gamification-bar';
import { SIDEBAR_HIDDEN_PATHS } from '@/lib/app-layout-paths';

export function MainColumn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sidebarVisible = !(SIDEBAR_HIDDEN_PATHS as readonly string[]).includes(pathname);

  return (
    <div
      className={cn(
        'relative flex h-screen w-full max-w-none flex-col overflow-hidden bg-[#0D0D0F] text-accent-white shadow-none sm:h-[844px] sm:max-h-[844px] sm:max-w-[390px] sm:rounded-[40px] sm:border sm:border-white/10 sm:shadow-2xl lg:h-screen lg:max-h-none lg:max-w-none lg:rounded-none lg:border-0 lg:shadow-none',
        sidebarVisible && 'lg:ml-72'
      )}
    >
      <div className="relative z-0 flex-1 overflow-y-auto pb-[80px] scrollbar-none app-background lg:pb-6">
        {sidebarVisible ? <GamificationBar /> : null}
        {children}
      </div>
      <MobileNav />
    </div>
  );
}
