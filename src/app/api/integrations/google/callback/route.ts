import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  exchangeGoogleCodeForTokens,
  fetchGooglePrimaryCalendarEvents,
  getGoogleOAuthConfig,
} from '@/lib/integrations/google-calendar';

function redirectToSettingsWithStatus(status: 'connected' | 'error', message?: string) {
  const url = new URL('/settings/integrations', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  url.searchParams.set('google', status);
  if (message) url.searchParams.set('message', message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get('google_oauth_state')?.value ?? null;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const response = redirectToSettingsWithStatus('error', error);
    response.cookies.delete('google_oauth_state');
    return response;
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    const response = redirectToSettingsWithStatus('error', 'invalid_oauth_state');
    response.cookies.delete('google_oauth_state');
    return response;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const response = redirectToSettingsWithStatus('error', 'unauthorized');
    response.cookies.delete('google_oauth_state');
    return response;
  }

  const config = getGoogleOAuthConfig();
  if (!config) {
    const response = redirectToSettingsWithStatus('error', 'oauth_not_configured');
    response.cookies.delete('google_oauth_state');
    return response;
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens(config, code);
    const expiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString() : null;

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      cache: 'no-store',
    });
    const userInfo = userInfoResponse.ok
      ? ((await userInfoResponse.json()) as { email?: string })
      : { email: undefined };

    const { data: existing } = await supabase
      .from('calendar_integrations')
      .select('refresh_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle();

    const refreshTokenToSave = tokens.refreshToken || existing?.refresh_token || null;

    const { error: upsertError } = await supabase.from('calendar_integrations').upsert(
      {
        user_id: user.id,
        provider: 'google',
        provider_account_email: userInfo.email ?? null,
        access_token: tokens.accessToken,
        refresh_token: refreshTokenToSave,
        token_type: tokens.tokenType,
        scope: tokens.scope,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_error: null,
      },
      { onConflict: 'user_id,provider' }
    );

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(now.getDate() - 30);
    const timeMax = new Date(now);
    timeMax.setDate(now.getDate() + 90);

    const events = await fetchGooglePrimaryCalendarEvents({
      accessToken: tokens.accessToken,
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
      const { error: eventError } = await supabase.from('calendar_external_events').insert(inserts);
      if (eventError) throw new Error(eventError.message);
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

    const response = redirectToSettingsWithStatus('connected');
    response.cookies.delete('google_oauth_state');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'google_callback_failed';
    const response = redirectToSettingsWithStatus('error', message);
    response.cookies.delete('google_oauth_state');
    return response;
  }
}
