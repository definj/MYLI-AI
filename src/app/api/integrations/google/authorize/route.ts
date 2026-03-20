import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { buildGoogleAuthorizeUrl, getGoogleOAuthConfig } from '@/lib/integrations/google-calendar';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL('/onboarding', request.url));

  const config = getGoogleOAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured. Missing GOOGLE_CLIENT_ID/SECRET or NEXT_PUBLIC_APP_URL.' },
      { status: 500 }
    );
  }

  const state = randomBytes(24).toString('hex');
  const authUrl = buildGoogleAuthorizeUrl(config, state);
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  return response;
}
