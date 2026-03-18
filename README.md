# MYLI — Lifestyle Intelligence

MYLI is a premium, minimalist-luxury full-stack web application designed for comprehensive lifestyle intelligence. It features dual tracks for Physical (body) and Mental (mind) health, powered by AI insights, personalized planning, and seamless integrations.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Components**: shadcn/ui
- **Backend & Auth**: Supabase (Postgres, Auth, Realtime, Storage)
- **AI Integration**: Anthropic Claude API (claude-sonnet-4-20250514), Claude Vision API

## Development Order & Progress.

### ✅ Phase 1 — Foundation (Completed)
- [x] 1. Next.js project setup with Tailwind, Framer Motion, TypeScript
- [x] 2. Design system: CSS variables, typography, base components (Button, Card, Input, Modal)
- [x] 3. Supabase project: schema, RLS policies, storage buckets
- [x] 4. Authentication: all 4 login methods via Supabase Auth

### ✅ Phase 2 — Onboarding & Profiles (Completed)
- [x] 5. Onboarding wizard (all 5 steps)
- [x] 6. Profile creation and physical/mental data storage
- [x] 7. BMI/BMR/TDEE calculation display

### ✅ Phase 3 — Physical Core (Completed)
- [x] 8. Meal logging with camera + Claude Vision macro analysis
- [x] 9. Macro tracking dashboard with animated rings
- [x] 10. Workout plan generation (3 tiers via Claude API)
- [x] 11. Workout logging interface

### ✅ Phase 4 — Mental Core (Completed)
- [x] 12. Task manager with categories and priority matrix
- [x] 13. Daily rituals builder
- [ ] 14. Google Calendar + Outlook OAuth integration
- [ ] 15. Notion + Todoist integration

### ✅ Phase 5 — Intelligence Layer (Completed)
- [x] 16. Vitamin deficiency analysis (5-day trigger)
- [x] 17. AI daily brief (morning cron edge function)
- [x] 18. AI Life Coach chat interface

### ✅ Phase 6 — Engagement (Completed)
- [x] 19. Streak system with animations
- [x] 20. Achievement badges system
- [x] 21. MYLI Score calculation
- [x] 22. Social feed, following, reactions

### ✅ Phase 7 — Polish (Completed)
- [x] 23. Push notifications
- [x] 24. Settings pages + privacy
- [x] 25. Performance optimization, loading skeletons
- [x] 26. Mobile responsiveness audit
- [x] 27. Stripe subscription placeholder

---

## Onboarding Update 3/18

The onboarding flow (`src/app/onboarding/page.tsx`) was overhauled with the following changes:

### 1. OAuth Removed — Email & Phone as Primary Auth
- Removed Apple and Google OAuth buttons and the `OR` divider from Step 2.
- The default Step 2 view now presents two clear options: **Email** or **Phone**.
- Removed the "I am already authenticated" bypass button entirely.

### 2. Email Auth — Sign Up / Sign In Distinction
- The **Sign In** / **Create Account** toggle is now at the top of the email form for visual clarity.
- A **Full name** field appears only when creating a new account.
- The user's name is passed to Supabase as `data: { full_name: name }` during sign-up.

### 3. Phone Auth — OTP with Name Capture
- Added helper text explaining the phone OTP flow ("An account will be created if you don't have one.").
- An optional **Full name** field is shown on the initial phone request screen.
- The name is passed as user metadata in the `signInWithOtp` call.

### 4. Metric / Imperial Toggle on Physical Profile
- Step 3 now includes a **Metric (kg / cm)** / **Imperial (lbs / ft)** toggle.
- Imperial inputs (feet, inches, lbs) are converted to metric (cm, kg) automatically before saving.
- The user's preferred `unit_system` is saved to the `physical_profiles` table.
- **Migration required:** `supabase/migrations/20260318004000_add_unit_system.sql` adds a `unit_system text` column.

### 5. Descriptive Step Labels
- Replaced `Step X of 5` with contextual labels: *Choose Your Track*, *Create Account*, *Physical Profile*, *Mental Profile*, *You're Ready*.

### 6. Physical Profile Validation
- The Continue button on Step 3 now validates that age, sex, height, and weight are all filled in before allowing the user to proceed.

### Supabase Configuration Checklist
- **Auth → Providers → Email**: Enable Email provider. Optionally disable "Confirm email" for development.
- **Auth → Providers → Phone**: Enable Phone provider with Twilio (or similar) SMS credentials.
- **Database**: Run `npx supabase db push` to apply the `unit_system` column migration.
- **Environment**: Ensure `NEXT_PUBLIC_APP_URL` is set in `.env.local`.

---

## Running Locally

### Hosted Supabase (recommended team workflow)
1. Copy `.env.local.example` to `.env.local`.
2. Fill in hosted project keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Fill in AI/integration keys as needed for the feature area you're working on.
4. Run the development server:
   ```bash
   npm install
   npm run dev
   ```

### Optional local Supabase fallback
1. Ensure Docker is running.
2. Start local services:
   ```bash
   npx supabase start
   ```
3. Use the local keys printed by the CLI in `.env.local`.
4. Apply migrations to local DB:
   ```bash
   npx supabase db reset
   ```

## Hosted Supabase Migration Workflow

1. Link your repo to the hosted Supabase project:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
2. Push migrations:
   ```bash
   npx supabase db push
   ```
3. Verify policies and permissions using the matrix in [docs/rls-matrix.md](docs/rls-matrix.md).