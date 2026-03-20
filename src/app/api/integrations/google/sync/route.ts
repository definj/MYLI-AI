import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchGooglePrimaryCalendarEvents,
  getGoogleOAuthConfig,
  refreshGoogleAccessToken,
} from '@/lib/integrations/google-calendar';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = getGoogleOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: 'Google OAuth is not configured.' }, { status: 500 });
  }

  const { data: integration, error: integrationError } = await supabase
    .from('calendar_integrations')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle();

  if (integrationError) return NextResponse.json({ error: integrationError.message }, { status: 500 });
  if (!integration) return NextResponse.json({ error: 'Google Calendar is not connected.' }, { status: 400 });

  try {
    let accessToken: string = integration.access_token;
    let refreshToken: string | null = integration.refresh_token;
    const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
    const isExpired = Boolean(expiresAt && expiresAt.getTime() - Date.now() < 60_000);

    if (isExpired && refreshToken) {
      const refreshed = await refreshGoogleAccessToken(config, refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      const nextExpiry = refreshed.expiresIn
        ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
        : integration.expires_at;
      await supabase
        .from('calendar_integrations')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: nextExpiry,
          token_type: refreshed.tokenType,
          scope: refreshed.scope,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('provider', 'google');
    }

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(now.getDate() - 30);
    const timeMax = new Date(now);
    timeMax.setDate(now.getDate() + 90);

    const events = await fetchGooglePrimaryCalendarEvents({
      accessToken,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });

    await supabase
      .from('calendar_external_events')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google');

    if (events.length > 0) {
      const inserts = events.map((event) => ({
        user_id: user.id,
        provider: 'google',
        ...event,
        updated_at: new Date().toISOString(),
      }));
      const { error: insertError } = await supabase.from('calendar_external_events').insert(inserts);
      if (insertError) throw new Error(insertError.message);
    }

    await supabase
      .from('calendar_integrations')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', 'google');

    return NextResponse.json({ ok: true, eventCount: events.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calendar sync failed';
    await supabase
      .from('calendar_integrations')
      .update({
        sync_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', 'google');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
