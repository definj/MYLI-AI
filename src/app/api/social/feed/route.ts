import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSocialFeed } from '@/lib/social/feed';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const data = await getSocialFeed(supabase, user?.id ?? null, 20);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load social feed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
