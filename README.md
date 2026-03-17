# MYLI — Lifestyle Intelligence

MYLI is a premium, minimalist-luxury full-stack web application designed for comprehensive lifestyle intelligence. It features dual tracks for Physical (body) and Mental (mind) health, powered by AI insights, personalized planning, and seamless integrations.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Components**: shadcn/ui
- **Backend & Auth**: Supabase (Postgres, Auth, Realtime, Storage)
- **AI Integration**: Anthropic Claude API (claude-sonnet-4-20250514), Claude Vision API

## Development Order & Progress

### ✅ Phase 1 — Foundation (Completed)
- [x] 1. Next.js project setup with Tailwind, Framer Motion, TypeScript
- [x] 2. Design system: CSS variables, typography, base components (Button, Card, Input, Modal)
- [x] 3. Supabase project: schema, RLS policies, storage buckets
- [x] 4. Authentication: all 4 login methods via Supabase Auth

### ⏳ Phase 2 — Onboarding & Profiles
- [ ] 5. Onboarding wizard (all 5 steps)
- [ ] 6. Profile creation and physical/mental data storage
- [ ] 7. BMI/BMR/TDEE calculation display

### ⏳ Phase 3 — Physical Core
- [ ] 8. Meal logging with camera + Claude Vision macro analysis
- [ ] 9. Macro tracking dashboard with animated rings
- [ ] 10. Workout plan generation (3 tiers via Claude API)
- [ ] 11. Workout logging interface

### ⏳ Phase 4 — Mental Core
- [ ] 12. Task manager with categories and priority matrix
- [ ] 13. Daily rituals builder
- [ ] 14. Google Calendar + Outlook OAuth integration
- [ ] 15. Notion + Todoist integration

### ⏳ Phase 5 — Intelligence Layer
- [ ] 16. Vitamin deficiency analysis (5-day trigger)
- [ ] 17. AI daily brief (morning cron edge function)
- [ ] 18. AI Life Coach chat interface

### ⏳ Phase 6 — Engagement
- [ ] 19. Streak system with animations
- [ ] 20. Achievement badges system
- [ ] 21. MYLI Score calculation
- [ ] 22. Social feed, following, reactions

### ⏳ Phase 7 — Polish
- [ ] 23. Push notifications
- [ ] 24. Settings pages + privacy
- [ ] 25. Performance optimization, loading skeletons
- [ ] 26. Mobile responsiveness audit
- [ ] 27. Stripe subscription placeholder

---

## Running Locally

1. Ensure you have Docker running (for Supabase CLI).
2. Start the local database:
   ```bash
   npx supabase start
   ```
3. Copy `.env.local.example` to `.env.local` and add your keys (including the Supabase URL and Anon Key provided by the `start` command).
4. Run the development server:
   ```bash
   npm run dev
   ```