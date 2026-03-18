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
      supabase.from('profiles').select('onboarding_complete').eq('user_id', user.id).single(),
      supabase.from('physical_profiles').select('id').eq('user_id', user.id).single(),
      supabase.from('mental_profiles').select('id').eq('user_id', user.id).single(),
    ])

    if (profile?.onboarding_complete || physicalProfile || mentalProfile) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary text-accent-white">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-10 sm:px-10 sm:py-14">
        <header className="flex items-center justify-between">
          <p className="font-display text-2xl tracking-tight">MYLI</p>
          <a
            href="/onboarding"
            className="rounded-md border border-accent-gold/60 px-4 py-2 text-sm font-medium text-accent-gold transition-colors hover:bg-accent-gold hover:text-bg-primary"
          >
            Start
          </a>
        </header>

        <section className="grid gap-10 py-10 md:grid-cols-2 md:gap-16">
          <div className="space-y-6">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-muted">
              Lifestyle Intelligence
            </p>
            <h1 className="font-display text-5xl leading-tight sm:text-6xl">
              Build a stronger body and sharper mind.
            </h1>
            <p className="max-w-xl text-base text-accent-muted sm:text-lg">
              MYLI combines nutrition, training, focus systems, and AI guidance into one
              intentional daily operating system.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="/onboarding"
                className="rounded-md bg-accent-gold px-5 py-3 text-sm font-semibold text-bg-primary transition-opacity hover:opacity-90"
              >
                Begin Your Journey
              </a>
              <a
                href="/dashboard"
                className="rounded-md border border-bg-surface bg-bg-surface px-5 py-3 text-sm font-medium text-accent-white transition-colors hover:bg-bg-secondary"
              >
                Open Dashboard
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-bg-surface bg-bg-surface/70 p-6">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent-muted">
              What you get
            </p>
            <ul className="mt-6 space-y-3 text-sm text-accent-white">
              <li>Track-adaptive dashboards for body and mind.</li>
              <li>AI-driven nutrition and recovery insight loops.</li>
              <li>Calendar, task, and habit systems in one place.</li>
              <li>Streaks, achievements, and MYLI score progression.</li>
            </ul>
          </div>
        </section>

        <footer className="pt-8 font-mono text-xs uppercase tracking-[0.2em] text-accent-muted">
          Designed for consistent high performance.
        </footer>
      </main>
    </div>
  )
}
