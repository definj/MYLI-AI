const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  appUrl: string;
};

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string | null;
  scope: string | null;
};

type GoogleEventsResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    description?: string;
    status?: string;
    location?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }>;
};

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl) return null;
  return { clientId, clientSecret, appUrl };
}

export function getGoogleRedirectUri(config: GoogleOAuthConfig) {
  return `${config.appUrl.replace(/\/+$/, '')}/api/integrations/google/callback`;
}

export function buildGoogleAuthorizeUrl(config: GoogleOAuthConfig, state: string) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getGoogleRedirectUri(config),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCodeForTokens(config: GoogleOAuthConfig, code: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: getGoogleRedirectUri(config),
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to exchange Google auth code: ${details}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  if (!data.access_token) {
    throw new Error('Google token response did not include access token.');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : null,
    tokenType: data.token_type ?? null,
    scope: data.scope ?? null,
  };
}

export async function refreshGoogleAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string
): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to refresh Google token: ${details}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  if (!data.access_token) {
    throw new Error('Google refresh token response did not include access token.');
  }

  return {
    accessToken: data.access_token,
    refreshToken,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : null,
    tokenType: data.token_type ?? null,
    scope: data.scope ?? null,
  };
}

function toIsoFromGoogleDate(input?: { dateTime?: string; date?: string }, fallbackEnd = false): string | null {
  if (!input) return null;
  if (input.dateTime) return input.dateTime;
  if (input.date) {
    return fallbackEnd
      ? `${input.date}T23:59:59.999Z`
      : `${input.date}T00:00:00.000Z`;
  }
  return null;
}

export async function fetchGooglePrimaryCalendarEvents(args: {
  accessToken: string;
  timeMin: string;
  timeMax: string;
}) {
  const params = new URLSearchParams({
    timeMin: args.timeMin,
    timeMax: args.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });

  const response = await fetch(`${GOOGLE_CALENDAR_EVENTS_URL}?${params.toString()}`, {
    headers: {
      authorization: `Bearer ${args.accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to fetch Google Calendar events: ${details}`);
  }

  const data = (await response.json()) as GoogleEventsResponse;
  const events = (data.items ?? [])
    .map((item) => {
      const startIso = toIsoFromGoogleDate(item.start, false);
      const endIso = toIsoFromGoogleDate(item.end, true);
      if (!item.id || !startIso || !endIso) return null;
      const allDay = Boolean(item.start?.date && !item.start?.dateTime);
      return {
        provider_event_id: item.id,
        calendar_id: 'primary',
        title: item.summary ?? 'Calendar event',
        description: item.description ?? null,
        start_at: startIso,
        end_at: endIso,
        is_all_day: allDay,
        status: item.status ?? null,
        location: item.location ?? null,
        html_link: item.htmlLink ?? null,
        raw_event: item,
      };
    })
    .filter((event): event is NonNullable<typeof event> => Boolean(event));

  return events;
}
