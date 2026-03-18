import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callAnthropicText, safeJsonParse } from '@/lib/ai/anthropic';

type BriefPayload = {
  greeting: string;
  body_summary: string;
  mind_summary: string;
  priorities: string[];
  motivation: string;
};

function fallbackBrief(): BriefPayload {
  return {
    greeting: 'Good morning.',
    body_summary: 'No recent meal or workout data to summarize. Log a meal or workout to see insights here.',
    mind_summary: 'No recent task activity. Add tasks or rituals to get a mind summary.',
    priorities: ['Log a meal', 'Complete one workout', 'Check in with your AI coach'],
    motivation: 'Small steps compound. Show up today and you will thank yourself tomorrow.',
  };
}

function normalizeBrief(input: Partial<BriefPayload> | null): BriefPayload | null {
  if (!input) return null;
  if (typeof input.greeting !== 'string' || typeof input.motivation !== 'string') return null;
  return {
    greeting: input.greeting,
    body_summary: String(input.body_summary ?? ''),
    mind_summary: String(input.mind_summary ?? ''),
    priorities: Array.isArray(input.priorities) ? input.priorities.map(String).slice(0, 5) : [],
    motivation: input.motivation,
  };
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const todayStr = new Date().toISOString().split('T')[0];

  const { data: existingBrief } = await supabase
    .from('daily_briefs')
    .select('*')
    .eq('user_id', user.id)
    .eq('brief_date', todayStr)
    .maybeSingle();

  if (existingBrief) {
    return NextResponse.json({
      greeting: existingBrief.greeting,
      body_summary: existingBrief.body_summary,
      mind_summary: existingBrief.mind_summary,
      priorities: existingBrief.priorities,
      motivation: existingBrief.motivation,
      cached: true,
    });
  }

  const yesterdayStart = new Date();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  yesterdayStart.setHours(0, 0, 0, 0);

  const [
    { data: profile },
    { data: physical },
    { data: mental },
    { data: yesterdayMeals },
    { data: streaks },
    { data: openTasks },
    { data: recentWorkouts },
  ] = await Promise.all([
    supabase.from('profiles').select('track, myli_score, streak_count').eq('user_id', user.id).single(),
    supabase.from('physical_profiles').select('goal, activity_level, tdee').eq('user_id', user.id).maybeSingle(),
    supabase.from('mental_profiles').select('productivity_style, sleep_avg').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('meal_logs')
      .select('calories, protein_g, carbs_g, fat_g, ai_description')
      .eq('user_id', user.id)
      .gte('logged_at', yesterdayStart.toISOString())
      .limit(10),
    supabase.from('streaks').select('streak_type, current_count').eq('user_id', user.id),
    supabase
      .from('daily_tasks')
      .select('title, priority, completed')
      .eq('user_id', user.id)
      .eq('completed', false)
      .limit(10),
    supabase
      .from('workout_logs')
      .select('date, completed, duration_min')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(3),
  ]);

  const streakMap = Object.fromEntries((streaks ?? []).map((s) => [s.streak_type, s.current_count]));

  const context = {
    track: profile?.track ?? 'both',
    myli_score: profile?.myli_score ?? 0,
    goal: physical?.goal,
    tdee: physical?.tdee,
    productivity_style: mental?.productivity_style,
    sleep_avg: mental?.sleep_avg,
    yesterday_meals: (yesterdayMeals ?? []).map((m) => ({
      calories: m.calories,
      protein: m.protein_g,
      description: m.ai_description,
    })),
    streaks: streakMap,
    open_tasks: (openTasks ?? []).map((t) => ({ title: t.title, priority: t.priority })),
    recent_workouts: recentWorkouts ?? [],
  };

  const prompt = `Generate a personalized morning daily brief for this MYLI user. Today is ${todayStr}.

User context: ${JSON.stringify(context)}

Return a single JSON object (no markdown, no explanation) with these keys:
- greeting (string): A short personalized morning greeting (1 sentence).
- body_summary (string): 2-3 sentences about yesterday's nutrition and workout progress. Reference actual data.
- mind_summary (string): 2-3 sentences about task progress, focus strategy, and mental energy.
- priorities (array of 3-5 strings): Top priorities for today based on their data and goals.
- motivation (string): One powerful motivational sentence tailored to their current streak and goal.`;

  const ai = await callAnthropicText(
    [{ role: 'user', content: prompt }],
    'You are MYLI, a lifestyle intelligence assistant. Return strict JSON only.'
  );

  const fallback = fallbackBrief();
  let brief: BriefPayload = fallback;
  if (ai.ok) {
    const parsed = safeJsonParse<Partial<BriefPayload>>(ai.text);
    brief = normalizeBrief(parsed) ?? fallback;
  }

  await supabase.from('daily_briefs').upsert({
    user_id: user.id,
    brief_date: todayStr,
    greeting: brief.greeting,
    body_summary: brief.body_summary,
    mind_summary: brief.mind_summary,
    priorities: brief.priorities,
    motivation: brief.motivation,
    raw_ai_response: ai.ok ? { text: ai.text } : { error: ai.error },
  }, { onConflict: 'user_id,brief_date' });

  return NextResponse.json(brief);
}
