import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/onboarding');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('track')
    .eq('user_id', user.id)
    .single();

  const track = profile?.track ?? 'both';
  if (track === 'physical') {
    redirect('/dashboard/body');
  }
  if (track === 'mental') {
    redirect('/dashboard/mind');
  }
  redirect('/dashboard/body');
}
