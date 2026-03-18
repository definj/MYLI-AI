import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isDashboardPath, isOnboardingPath, isPublicPath } from '@/lib/auth/routes'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && (isOnboardingPath(pathname) || (!isPublicPath(pathname)))) {
    const [{ data: profile }, { data: physicalProfile }, { data: mentalProfile }] = await Promise.all([
      supabase.from('profiles').select('onboarding_complete').eq('user_id', user.id).single(),
      supabase.from('physical_profiles').select('id').eq('user_id', user.id).single(),
      supabase.from('mental_profiles').select('id').eq('user_id', user.id).single(),
    ])

    const hasExistingData = profile?.onboarding_complete || physicalProfile || mentalProfile

    if (hasExistingData && !profile?.onboarding_complete) {
      await supabase.from('profiles').upsert(
        { user_id: user.id, onboarding_complete: true, last_active: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    }

    if (isOnboardingPath(pathname) && hasExistingData) {
      const url = request.nextUrl.clone()
      const next = request.nextUrl.searchParams.get('next')
      if (next && isDashboardPath(next)) {
        url.pathname = next
        url.search = ''
        return NextResponse.redirect(url)
      }
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (!isPublicPath(pathname) && !isOnboardingPath(pathname) && !hasExistingData) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
