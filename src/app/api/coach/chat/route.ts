import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicText } from '@/lib/ai/anthropic';

const MAX_HISTORY = 20;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rawMessages = body.messages ?? [];
  const lastUserMessage = [...rawMessages].reverse().find((m) => m.role === 'user')?.content;
  if (!lastUserMessage) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });

  const conversationHistory = rawMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }));

  const [{ data: profile }, { data: physical }] = await Promise.all([
    supabase.from('profiles').select('track, myli_score, streak_count').eq('user_id', user.id).single(),
    supabase.from('physical_profiles').select('goal, activity_level').eq('user_id', user.id).maybeSingle(),
  ]);

  const systemPrompt = [
    'You are MYLI, an AI Life Coach embedded in a lifestyle intelligence app.',
    'Be concise, encouraging, practical, and action-oriented.',
    'You have access to the user context below — reference it when relevant but do not repeat it verbatim.',
    `User track: ${profile?.track ?? 'both'}. MYLI Score: ${profile?.myli_score ?? 'unknown'}. Streak: ${profile?.streak_count ?? 0} days.`,
    physical ? `Fitness goal: ${physical.goal}. Activity level: ${physical.activity_level}.` : '',
    'Keep responses under 150 words unless the user asks for detail.',
  ].filter(Boolean).join(' ');

  const ai = await callAnthropicText(conversationHistory, systemPrompt);

  if (!ai.ok) {
    return NextResponse.json({
      content:
        'I can still help right now. Pick one small next step you can complete in 15 minutes, then we will build momentum from there.',
    });
  }

  return NextResponse.json({ content: ai.text });
}
