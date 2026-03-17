import { FeatureShell } from '@/components/app/feature-shell';

const integrations = [
  { name: 'Google', envs: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] },
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
      description="Connect Google, Apple, Microsoft, Notion, Todoist, and email integrations."
    >
      <div className="grid gap-3">
        {integrations.map((integration) => {
          const configured = integration.envs.every((key) => Boolean(process.env[key]));
          return (
            <div
              key={integration.name}
              className="flex items-center justify-between rounded-xl border border-bg-surface bg-bg-surface/70 px-4 py-3"
            >
              <div>
                <p className="font-medium text-accent-white">{integration.name}</p>
                <p className="text-xs text-accent-muted">
                  {configured
                    ? 'Configured in environment and ready to connect.'
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
