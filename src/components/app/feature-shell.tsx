import type { ReactNode } from 'react';

type FeatureShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function FeatureShell({ eyebrow, title, description, children }: FeatureShellProps) {
  return (
    <main className="min-h-screen bg-bg-primary px-4 py-8 text-accent-white sm:px-10 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent-muted sm:text-xs">{eyebrow}</p>
          <h1 className="mt-3 font-display text-3xl sm:mt-4 sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-accent-muted sm:mt-3 sm:text-base">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
