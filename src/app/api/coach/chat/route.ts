import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicText } from '@/lib/ai/anthropic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const messages = body.messages ?? [];
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content;
  if (!lastUserMessage) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });

  const ai = await callAnthropicText(
    [{ role: 'user', content: lastUserMessage }],
    'You are MYLI coach. Be concise, encouraging, practical, and action-oriented.'
  );

  if (!ai.ok) {
    return NextResponse.json({
      content:
        'I can still help right now. Pick one small next step you can complete in 15 minutes, then we will build momentum from there.',
    });
  }

  return NextResponse.json({ content: ai.text });
}
