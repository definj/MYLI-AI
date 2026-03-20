import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Home() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const [{ data: profile }, { data: physicalProfile }, { data: mentalProfile }] = await Promise.all([
      supabase.from('profiles').select('onboarding_complete').eq('user_id', user.id).maybeSingle(),
      supabase.from('physical_profiles').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('mental_profiles').select('id').eq('user_id', user.id).maybeSingle(),
    ])

    if (profile?.onboarding_complete || physicalProfile || mentalProfile) {
      redirect('/dashboard')
    }
  }

  redirect('/onboarding')
}
