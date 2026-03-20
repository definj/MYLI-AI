import type { ReactNode } from 'react';

type FeatureShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function FeatureShell({ eyebrow, title, description, children }: FeatureShellProps) {
  return (
    <main className="min-h-full bg-transparent px-6 pb-8 pt-8 text-accent-white">
      <div className="mx-auto max-w-[390px] space-y-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-white/60">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
