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
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/onboarding?error=AuthError`)
}
