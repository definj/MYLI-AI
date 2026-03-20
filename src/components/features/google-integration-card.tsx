'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

type IntegrationStatus = {
  configured: boolean;
  connected: boolean;
  integration: {
    provider_account_email: string | null;
    connected_at: string | null;
    last_synced_at: string | null;
    expires_at: string | null;
    sync_error: string | null;
  } | null;
};

export function GoogleIntegrationCard() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/integrations/google/status', { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to fetch integration status.' }));
        throw new Error(payload.error || 'Failed to fetch integration status.');
      }
      const payload = (await response.json()) as IntegrationStatus;
      setStatus(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch integration status.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void readStatus();
  }, []);

  const connect = () => {
    window.location.assign('/api/integrations/google/authorize');
  };

  const disconnect = async () => {
    setIsDisconnecting(true);
    setError(null);
    try {
      const response = await fetch('/api/integrations/google/disconnect', { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to disconnect Google Calendar.' }));
        throw new Error(payload.error || 'Failed to disconnect Google Calendar.');
      }
      await readStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Google Calendar.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const sync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const response = await fetch('/api/integrations/google/sync', { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to sync Google Calendar.' }));
        throw new Error(payload.error || 'Failed to sync Google Calendar.');
      }
      await readStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync Google Calendar.');
    } finally {
      setIsSyncing(false);
    }
  };

  const connectedLabel = useMemo(() => {
    if (!status?.connected) return 'Disconnected';
    return status.integration?.provider_account_email
      ? `Connected as ${status.integration.provider_account_email}`
      : 'Connected';
  }, [status]);
  const callbackStatus = searchParams.get('google');
  const callbackMessage = searchParams.get('message');

  return (
    <div className="glass-card rounded-2xl px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium text-accent-white">Google Calendar</p>
          <p className="mt-1 text-xs text-accent-muted">
            Sync events into the weekly MYLI calendar for better planning context.
          </p>
          {status?.integration?.last_synced_at && (
            <p className="mt-2 text-xs text-accent-muted">
              Last synced: {new Date(status.integration.last_synced_at).toLocaleString()}
            </p>
          )}
          {status?.integration?.sync_error && (
            <p className="mt-2 text-xs text-danger">{status.integration.sync_error}</p>
          )}
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-mono uppercase ${
            status?.connected ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
          }`}
        >
          {connectedLabel}
        </span>
      </div>

      {!status?.configured && !isLoading && (
        <p className="mt-3 text-xs text-warning">
          Missing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `NEXT_PUBLIC_APP_URL`.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={connect}
          disabled={isLoading || !status?.configured || status.connected}
          className="bg-accent-gold text-bg-primary hover:bg-accent-gold/90"
        >
          Connect
        </Button>
        <Button
          type="button"
          onClick={sync}
          disabled={isLoading || !status?.connected || isSyncing}
          className="bg-bg-secondary text-accent-white hover:bg-bg-primary"
        >
          {isSyncing ? 'Syncing...' : 'Sync now'}
        </Button>
        <Button
          type="button"
          onClick={disconnect}
          disabled={isLoading || !status?.connected || isDisconnecting}
          className="bg-danger/15 text-danger hover:bg-danger/25"
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {!error && callbackStatus === 'error' && callbackMessage && (
        <p className="mt-3 text-sm text-danger">{callbackMessage}</p>
      )}
      {!error && callbackStatus === 'connected' && (
        <p className="mt-3 text-sm text-success">Google Calendar connected successfully.</p>
      )}
    </div>
  );
}
