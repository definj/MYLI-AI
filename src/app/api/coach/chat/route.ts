import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicText } from '@/lib/ai/anthropic';

const MAX_HISTORY = 40;

/* ────────────────────────────────────────────
   GET — load persisted chat history
   ──────────────────────────────────────────── */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: messages, error } = await supabase
    .from('coach_messages')
    .select('role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: messages ?? [] });
}

/* ────────────────────────────────────────────
   POST — send message, get AI reply, persist both
   ──────────────────────────────────────────── */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userMessage = body.message?.trim();
  if (!userMessage) return NextResponse.json({ error: 'Message is required.' }, { status: 400 });

  // Save user message
  await supabase.from('coach_messages').insert({
    user_id: user.id,
    role: 'user',
    content: userMessage,
  });

  // Load recent history from DB for context
  const { data: history } = await supabase
    .from('coach_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);

  const conversationHistory = (history ?? [])
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Fetch full user context
  const [
    { data: profile },
    { data: physical },
    { data: mental },
    { data: recentTasks },
    { data: recentMeals },
    { data: recentWorkouts },
    { data: streaks },
    { data: todayBrief },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('physical_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('mental_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('daily_tasks')
      .select('title, completed, priority, category, due_at')
      .eq('user_id', user.id)
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(15),
    supabase
      .from('meal_logs')
      .select('meal_type, calories, protein_g, carbs_g, fat_g, ai_description, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(7),
    supabase
      .from('workout_logs')
      .select('date, duration_min, completed, exercises, notes')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(5),
    supabase
      .from('streaks')
      .select('streak_type, current_count, longest_count, last_date')
      .eq('user_id', user.id),
    supabase
      .from('daily_briefs')
      .select('greeting, body_summary, mind_summary, priorities, motivation')
      .eq('user_id', user.id)
      .eq('brief_date', new Date().toISOString().split('T')[0])
      .maybeSingle(),
  ]);

  const contextSections: string[] = [
    'You are MYLI, an AI Life Coach embedded in a premium lifestyle intelligence app.',
    'You have FULL access to the user\'s profile and recent activity data below.',
    'Reference this data naturally and proactively when it is relevant to the user\'s question.',
    'Be concise, encouraging, practical, and action-oriented.',
    'When the user asks about their profile, stats, tasks, meals, workouts, or streaks — answer directly from the data.',
    '',
    '=== USER PROFILE ===',
    `Track: ${profile?.track ?? 'both'}`,
    `MYLI Score: ${profile?.myli_score ?? 'not yet calculated'}`,
    `Streak count: ${profile?.streak_count ?? 0} days`,
    `Username: ${profile?.username ?? 'not set'}`,
    `Onboarding complete: ${profile?.onboarding_complete ?? false}`,
  ];

  if (physical) {
    contextSections.push(
      '',
      '=== PHYSICAL PROFILE ===',
      `Age: ${physical.age ?? 'unknown'}`,
      `Sex: ${physical.sex ?? 'unknown'}`,
      `Height: ${physical.height_cm ?? '?'} cm`,
      `Weight: ${physical.weight_kg ?? '?'} kg`,
      `BMI: ${physical.bmi ?? 'not calculated'}`,
      `BMR: ${physical.bmr ?? 'not calculated'} cal/day`,
      `TDEE: ${physical.tdee ?? 'not calculated'} cal/day`,
      `Activity level: ${physical.activity_level ?? 'unknown'}`,
      `Fitness goal: ${physical.goal ?? 'unknown'}`,
      `Unit preference: ${physical.unit_system ?? 'metric'}`,
    );
  }

  if (mental) {
    contextSections.push(
      '',
      '=== MENTAL PROFILE ===',
      `Stress sources: ${Array.isArray(mental.stress_sources) ? mental.stress_sources.join(', ') : 'none listed'}`,
      `Average sleep: ${mental.sleep_avg ?? 'unknown'} hours`,
      `Productivity style: ${mental.productivity_style ?? 'unknown'}`,
      `Life areas to improve: ${Array.isArray(mental.life_areas) ? mental.life_areas.join(', ') : 'none listed'}`,
    );
  }

  if (recentTasks && recentTasks.length > 0) {
    const pending = recentTasks.filter((t) => !t.completed);
    const done = recentTasks.filter((t) => t.completed);
    contextSections.push(
      '',
      '=== TASKS ===',
      `Pending tasks (${pending.length}):`,
      ...pending.map((t) => `  - [${t.priority ?? 'normal'}] ${t.title}${t.category ? ` (${t.category})` : ''}${t.due_at ? ` — due ${t.due_at}` : ''}`),
      `Completed tasks (${done.length}):`,
      ...done.map((t) => `  - ✓ ${t.title}`),
    );
  } else {
    contextSections.push('', '=== TASKS ===', 'No tasks logged yet.');
  }

  if (recentMeals && recentMeals.length > 0) {
    contextSections.push(
      '',
      '=== RECENT MEALS (last 7) ===',
      ...recentMeals.map((m) =>
        `  - ${m.meal_type ?? 'meal'} (${m.logged_at?.split('T')[0] ?? '?'}): ${m.calories ?? '?'} cal, ${m.protein_g ?? '?'}g protein, ${m.carbs_g ?? '?'}g carbs, ${m.fat_g ?? '?'}g fat${m.ai_description ? ` — "${m.ai_description}"` : ''}`
      ),
    );
  } else {
    contextSections.push('', '=== RECENT MEALS ===', 'No meals logged yet.');
  }

  if (recentWorkouts && recentWorkouts.length > 0) {
    contextSections.push(
      '',
      '=== RECENT WORKOUTS (last 5) ===',
      ...recentWorkouts.map((w) => {
        const exerciseCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
        return `  - ${w.date}: ${w.duration_min ?? '?'} min, ${w.completed ? 'completed' : 'incomplete'}, ${exerciseCount} exercises${w.notes ? ` — "${w.notes}"` : ''}`;
      }),
    );
  } else {
    contextSections.push('', '=== RECENT WORKOUTS ===', 'No workouts logged yet.');
  }

  if (streaks && streaks.length > 0) {
    contextSections.push(
      '',
      '=== STREAKS ===',
      ...streaks.map((s) => `  - ${s.streak_type}: current ${s.current_count} days, best ${s.longest_count} days (last: ${s.last_date ?? 'never'})`),
    );
  } else {
    contextSections.push('', '=== STREAKS ===', 'No streaks tracked yet.');
  }

  if (todayBrief) {
    contextSections.push(
      '',
      '=== TODAY\'S DAILY BRIEF ===',
      todayBrief.greeting ? `Greeting: ${todayBrief.greeting}` : '',
      todayBrief.body_summary ? `Body summary: ${todayBrief.body_summary}` : '',
      todayBrief.mind_summary ? `Mind summary: ${todayBrief.mind_summary}` : '',
      todayBrief.priorities?.length ? `Priorities: ${todayBrief.priorities.join('; ')}` : '',
      todayBrief.motivation ? `Motivation: ${todayBrief.motivation}` : '',
    );
  }

  contextSections.push(
    '',
    'Keep responses under 200 words unless the user asks for detail.',
    'If the user asks a question you can answer from the data above, answer it directly.',
    'If the user\'s data is missing (e.g. no meals logged), acknowledge it and suggest they start tracking.',
  );

  const systemPrompt = contextSections.filter(Boolean).join('\n');

  const ai = await callAnthropicText(conversationHistory, systemPrompt);

  const assistantContent = ai.ok
    ? ai.text
    : 'I can still help right now. Pick one small next step you can complete in 15 minutes, then we will build momentum from there.';

  // Save assistant reply
  await supabase.from('coach_messages').insert({
    user_id: user.id,
    role: 'assistant',
    content: assistantContent,
  });

  return NextResponse.json({ content: assistantContent });
}

/* ────────────────────────────────────────────
   DELETE — clear chat history
   ──────────────────────────────────────────── */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('coach_messages')
    .delete()
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
