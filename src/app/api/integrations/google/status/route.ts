import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const configured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.NEXT_PUBLIC_APP_URL
  );

  const { data, error } = await supabase
    .from('calendar_integrations')
    .select('provider_account_email, connected_at, last_synced_at, expires_at, sync_error')
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    configured,
    connected: Boolean(data),
    integration: data ?? null,
  });
}
