import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    title?: string;
    body?: string;
    url?: string;
  };

  if (!body.user_id || !body.title) {
    return NextResponse.json({ error: 'user_id and title are required.' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('user_id', body.user_id);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No push subscriptions found for this user.' });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({
      sent: 0,
      message: 'VAPID keys not configured. Push notifications require NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.',
      subscriptions_found: subscriptions.length,
    });
  }

  const payload = JSON.stringify({
    title: body.title,
    body: body.body ?? '',
    url: body.url ?? '/dashboard',
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      const response = await fetch(sub.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (response.ok || response.status === 201) sent++;
    } catch {
      // Subscription may have expired
    }
  }

  return NextResponse.json({ sent, total: subscriptions.length });
}
