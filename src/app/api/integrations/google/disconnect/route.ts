import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [eventResult, integrationResult] = await Promise.all([
    supabase.from('calendar_external_events').delete().eq('user_id', user.id).eq('provider', 'google'),
    supabase.from('calendar_integrations').delete().eq('user_id', user.id).eq('provider', 'google'),
  ]);

  if (eventResult.error) return NextResponse.json({ error: eventResult.error.message }, { status: 500 });
  if (integrationResult.error) return NextResponse.json({ error: integrationResult.error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
