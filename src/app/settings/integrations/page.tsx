import { Suspense } from 'react';
import { FeatureShell } from '@/components/app/feature-shell';
import { GoogleIntegrationCard } from '@/components/features/google-integration-card';

const integrations = [
  { name: 'Apple', envs: ['APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'] },
  { name: 'Microsoft', envs: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'] },
  { name: 'Notion', envs: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET'] },
  { name: 'Todoist', envs: ['TODOIST_CLIENT_ID', 'TODOIST_CLIENT_SECRET'] },
];

export default function SettingsIntegrationsPage() {
  return (
    <FeatureShell
      eyebrow="Settings / Integrations"
      title="Connected Services"
      description="Connect your external tools so MYLI can sync planning context across your week."
    >
      <div className="grid gap-4">
        <Suspense
          fallback={
            <div className="glass-card rounded-2xl px-5 py-4">
              <p className="text-sm text-accent-muted">Loading Google integration...</p>
            </div>
          }
        >
          <GoogleIntegrationCard />
        </Suspense>

        {integrations.map((integration) => {
          const configured = integration.envs.every((key) => Boolean(process.env[key]));
          return (
            <div
              key={integration.name}
              className="glass-card flex items-center justify-between rounded-2xl px-4 py-3"
            >
              <div>
                <p className="font-medium text-accent-white">{integration.name}</p>
                <p className="text-xs text-accent-muted">
                  {configured
                    ? 'Credentials configured. Provider UX is queued in the next integration sprint.'
                    : 'Missing credentials. You can add this integration later.'}
                </p>
              </div>
              <span
                className={`rounded-md px-2 py-1 text-xs font-mono uppercase ${
                  configured ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                }`}
              >
                {configured ? 'Ready' : 'Optional'}
              </span>
            </div>
          );
        })}
      </div>
    </FeatureShell>
  );
}
