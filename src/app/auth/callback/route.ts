import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeNextPath(nextParam: string | null) {
  if (!nextParam) return '/dashboard'
  if (!nextParam.startsWith('/')) return '/dashboard'
  if (nextParam.startsWith('/auth')) return '/dashboard'
  return nextParam
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const [{ data: profile }, { data: physicalProfile }, { data: mentalProfile }] = await Promise.all([
          supabase.from('profiles').select('onboarding_complete').eq('user_id', user.id).maybeSingle(),
          supabase.from('physical_profiles').select('id').eq('user_id', user.id).maybeSingle(),
          supabase.from('mental_profiles').select('id').eq('user_id', user.id).maybeSingle(),
        ])

        const hasExistingData =
          profile?.onboarding_complete || physicalProfile || mentalProfile

        if (!hasExistingData) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/onboarding?error=AuthError`)
}
