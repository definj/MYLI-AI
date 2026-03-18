'use client';

import { Button } from '@/components/ui/button';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      'Basic meal logging (3/day)',
      'Workout plan generation',
      'Task manager',
      'Community feed access',
    ],
    current: true,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    features: [
      'Unlimited meal logging',
      'Advanced vitamin analysis',
      'AI Coach with full history',
      'Priority workout generation',
      'Data export',
      'Custom streak goals',
    ],
    current: false,
  },
  {
    name: 'Elite',
    price: '$19.99',
    period: '/month',
    features: [
      'Everything in Pro',
      'Calendar & Notion integrations',
      'Daily AI brief',
      'Private coaching sessions',
      'Early access to new features',
      'White-glove onboarding',
    ],
    current: false,
  },
];

export default function SettingsSubscriptionPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-gold/30 bg-bg-surface/70 p-4">
        <p className="text-sm text-accent-muted">
          Subscription management is coming soon. When it launches, you will be able to upgrade and manage billing here.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 ${
              plan.current
                ? 'border-accent-gold bg-bg-surface/70'
                : 'border-bg-surface bg-bg-surface/40'
            }`}
          >
            <p className="font-mono text-xs uppercase tracking-widest text-accent-muted">{plan.name}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-3xl text-accent-white">{plan.price}</span>
              <span className="text-sm text-accent-muted">{plan.period}</span>
            </div>
            <ul className="mt-5 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-accent-muted">
                  <span className="mt-0.5 text-accent-gold">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className={`mt-6 w-full ${
                plan.current
                  ? 'bg-bg-secondary text-accent-muted'
                  : 'bg-accent-gold text-bg-primary hover:bg-accent-gold/90'
              }`}
              disabled={plan.current}
            >
              {plan.current ? 'Current Plan' : 'Coming Soon'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
