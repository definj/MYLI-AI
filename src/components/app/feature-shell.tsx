import type { ReactNode } from 'react';

type FeatureShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function FeatureShell({ eyebrow, title, description, children }: FeatureShellProps) {
  return (
    <main className="min-h-screen bg-bg-primary px-6 py-10 text-accent-white sm:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-muted">{eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-accent-muted">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
