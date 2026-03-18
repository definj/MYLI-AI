-- ============================================================
-- MYLI Combined Migration — paste this into Supabase SQL Editor
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS
-- ============================================================

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. PROFILES
create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  username text unique,
  avatar_url text,
  track text check (track in ('physical', 'mental', 'both')),
  created_at timestamp with time zone default now(),
  streak_count integer default 0,
  last_active timestamp with time zone default now(),
  myli_score integer default 0,
  onboarding_complete boolean default false
);

-- 3. PHYSICAL PROFILES
create table if not exists public.physical_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  age integer,
  sex text,
  height_cm numeric,
  weight_kg numeric,
  activity_level text,
  goal text,
  bmi numeric,
  bmr numeric,
  tdee numeric
);

-- 4. MENTAL PROFILES
create table if not exists public.mental_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  stress_sources text[],
  sleep_avg numeric,
  productivity_style text,
  life_areas text[]
);

-- 5. MEAL LOGS
create table if not exists public.meal_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  photo_url text,
  logged_at timestamp with time zone default now(),
  meal_type text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  ai_description text,
  raw_ai_response jsonb
);

-- 6. VITAMIN ANALYSIS
create table if not exists public.vitamin_analysis (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  generated_at timestamp with time zone default now(),
  deficiencies jsonb,
  recommendations jsonb,
  meal_log_ids uuid[]
);

-- 7. WORKOUT PLANS
create table if not exists public.workout_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  intensity text,
  plan_json jsonb,
  generated_at timestamp with time zone default now(),
  active boolean default true
);

-- 8. WORKOUT LOGS
create table if not exists public.workout_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date default current_date,
  exercises jsonb,
  duration_min integer,
  completed boolean default false,
  notes text
);

-- 9. DAILY TASKS
create table if not exists public.daily_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  due_at timestamp with time zone,
  completed boolean default false,
  priority text,
  source text,
  source_id text,
  category text
);

-- 10. STREAKS
create table if not exists public.streaks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  streak_type text not null,
  current_count integer default 0,
  longest_count integer default 0,
  last_date date
);

-- 11. SOCIAL CONNECTIONS
create table if not exists public.social_connections (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique(follower_id, following_id)
);

-- 12. FEED POSTS
create table if not exists public.feed_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content_type text not null,
  content jsonb,
  visibility text default 'public',
  likes_count integer default 0,
  comments_count integer default 0,
  created_at timestamp with time zone default now()
);

-- 13. USER ACHIEVEMENTS
create table if not exists public.user_achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  badge_key text not null,
  unlocked_at timestamp with time zone default now(),
  unique(user_id, badge_key)
);

-- 14. DAILY BRIEFS
create table if not exists public.daily_briefs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  generated_at timestamp with time zone default now(),
  brief_date date not null default current_date,
  greeting text,
  body_summary text,
  mind_summary text,
  priorities text[],
  motivation text,
  raw_ai_response jsonb,
  unique(user_id, brief_date)
);

-- 15. PUSH SUBSCRIPTIONS
create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  created_at timestamp with time zone default now(),
  unique(user_id, endpoint)
);

-- 16. COACH MESSAGES
create table if not exists public.coach_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default now()
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.physical_profiles enable row level security;
alter table public.mental_profiles enable row level security;
alter table public.meal_logs enable row level security;
alter table public.vitamin_analysis enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_logs enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.streaks enable row level security;
alter table public.social_connections enable row level security;
alter table public.feed_posts enable row level security;
alter table public.user_achievements enable row level security;
alter table public.daily_briefs enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.coach_messages enable row level security;

-- ============================================================
-- RLS POLICIES (drop first so re-runs are safe)
-- ============================================================

-- Profiles
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can insert their own profile." on public.profiles;
drop policy if exists "Users can update own profile." on public.profiles;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = user_id);

-- Physical profiles
drop policy if exists "Users can manage their own physical_profiles." on public.physical_profiles;
create policy "Users can manage their own physical_profiles." on public.physical_profiles for all using (auth.uid() = user_id);

-- Mental profiles
drop policy if exists "Users can manage their own mental_profiles." on public.mental_profiles;
create policy "Users can manage their own mental_profiles." on public.mental_profiles for all using (auth.uid() = user_id);

-- Meal logs
drop policy if exists "Users can manage their own meal_logs." on public.meal_logs;
create policy "Users can manage their own meal_logs." on public.meal_logs for all using (auth.uid() = user_id);

-- Vitamin analysis
drop policy if exists "Users can manage their own vitamin_analysis." on public.vitamin_analysis;
create policy "Users can manage their own vitamin_analysis." on public.vitamin_analysis for all using (auth.uid() = user_id);

-- Workout plans
drop policy if exists "Users can manage their own workout_plans." on public.workout_plans;
create policy "Users can manage their own workout_plans." on public.workout_plans for all using (auth.uid() = user_id);

-- Workout logs
drop policy if exists "Users can manage their own workout_logs." on public.workout_logs;
create policy "Users can manage their own workout_logs." on public.workout_logs for all using (auth.uid() = user_id);

-- Daily tasks
drop policy if exists "Users can manage their own daily_tasks." on public.daily_tasks;
create policy "Users can manage their own daily_tasks." on public.daily_tasks for all using (auth.uid() = user_id);

-- Streaks
drop policy if exists "Users can manage their own streaks." on public.streaks;
create policy "Users can manage their own streaks." on public.streaks for all using (auth.uid() = user_id);

-- Achievements
drop policy if exists "Users can manage their own achievements." on public.user_achievements;
create policy "Users can manage their own achievements." on public.user_achievements for all using (auth.uid() = user_id);

-- Daily briefs
drop policy if exists "Users can manage their own daily_briefs." on public.daily_briefs;
create policy "Users can manage their own daily_briefs." on public.daily_briefs for all using (auth.uid() = user_id);

-- Push subscriptions
drop policy if exists "Users can manage their own push_subscriptions." on public.push_subscriptions;
create policy "Users can manage their own push_subscriptions." on public.push_subscriptions for all using (auth.uid() = user_id);

-- Coach messages
drop policy if exists "Users can manage their own coach_messages." on public.coach_messages;
create policy "Users can manage their own coach_messages." on public.coach_messages for all using (auth.uid() = user_id);

-- Social connections
drop policy if exists "Social connections are viewable by everyone." on public.social_connections;
drop policy if exists "Users can follow others." on public.social_connections;
drop policy if exists "Users can unfollow others." on public.social_connections;
create policy "Social connections are viewable by everyone." on public.social_connections for select using (true);
create policy "Users can follow others." on public.social_connections for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow others." on public.social_connections for delete using (auth.uid() = follower_id);

-- Feed posts
drop policy if exists "Feed posts are viewable by everyone if public." on public.feed_posts;
drop policy if exists "Users can manage their own feed_posts." on public.feed_posts;
create policy "Feed posts are viewable by everyone if public." on public.feed_posts for select using (visibility = 'public' or auth.uid() = user_id);
create policy "Users can manage their own feed_posts." on public.feed_posts for all using (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public) values ('meal_photos', 'meal_photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Anyone can upload an avatar." on storage.objects;
drop policy if exists "Users can update their avatars." on storage.objects;
drop policy if exists "Meal photos are publicly accessible." on storage.objects;
drop policy if exists "Authenticated users can upload meal photos." on storage.objects;
drop policy if exists "Users can delete their own meal photos." on storage.objects;

create policy "Avatar images are publicly accessible." on storage.objects for select using (bucket_id = 'avatars');
create policy "Anyone can upload an avatar." on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "Users can update their avatars." on storage.objects for update using (auth.uid() = owner);
create policy "Meal photos are publicly accessible." on storage.objects for select using (bucket_id = 'meal_photos');
create policy "Authenticated users can upload meal photos." on storage.objects for insert with check (bucket_id = 'meal_photos' and auth.role() = 'authenticated');
create policy "Users can delete their own meal photos." on storage.objects for delete using (auth.uid() = owner);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, created_at, last_active, onboarding_complete)
  values (new.id, now(), now(), false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill any existing auth users missing a profile
insert into public.profiles (user_id, created_at, last_active, onboarding_complete)
select u.id, now(), now(), false
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

-- ============================================================
-- CONSTRAINTS & INDEXES
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'physical_profiles_activity_level_check') then
    alter table public.physical_profiles
      add constraint physical_profiles_activity_level_check
      check (activity_level in ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'physical_profiles_goal_check') then
    alter table public.physical_profiles
      add constraint physical_profiles_goal_check
      check (goal in ('lose_fat', 'build_muscle', 'improve_endurance', 'maintain', 'recomposition'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'daily_tasks_priority_check') then
    alter table public.daily_tasks
      add constraint daily_tasks_priority_check
      check (priority in ('low', 'medium', 'high', 'critical'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'daily_tasks_category_check') then
    alter table public.daily_tasks
      add constraint daily_tasks_category_check
      check (category in ('work', 'health', 'personal', 'finance', 'relationships', 'creative'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'feed_posts_visibility_check') then
    alter table public.feed_posts
      add constraint feed_posts_visibility_check
      check (visibility in ('public', 'followers', 'private'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'social_connections_no_self_follow') then
    alter table public.social_connections
      add constraint social_connections_no_self_follow
      check (follower_id <> following_id);
  end if;
end $$;

create index if not exists idx_profiles_user_id on public.profiles (user_id);
create index if not exists idx_profiles_created_at on public.profiles (created_at desc);
create index if not exists idx_physical_profiles_user_id on public.physical_profiles (user_id);
create index if not exists idx_mental_profiles_user_id on public.mental_profiles (user_id);
create index if not exists idx_meal_logs_user_id_logged_at on public.meal_logs (user_id, logged_at desc);
create index if not exists idx_vitamin_analysis_user_id_generated_at on public.vitamin_analysis (user_id, generated_at desc);
create index if not exists idx_workout_plans_user_id_generated_at on public.workout_plans (user_id, generated_at desc);
create index if not exists idx_workout_logs_user_id_date on public.workout_logs (user_id, date desc);
create index if not exists idx_daily_tasks_user_id_due_at on public.daily_tasks (user_id, due_at);
create index if not exists idx_daily_tasks_user_id_completed on public.daily_tasks (user_id, completed);
create index if not exists idx_streaks_user_id on public.streaks (user_id);
create index if not exists idx_social_connections_follower_id on public.social_connections (follower_id);
create index if not exists idx_social_connections_following_id on public.social_connections (following_id);
create index if not exists idx_feed_posts_user_id_created_at on public.feed_posts (user_id, created_at desc);
create index if not exists idx_feed_posts_visibility_created_at on public.feed_posts (visibility, created_at desc);
create index if not exists idx_user_achievements_user_id on public.user_achievements (user_id);
create index if not exists idx_daily_briefs_user_date on public.daily_briefs (user_id, brief_date desc);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions (user_id);
create index if not exists idx_coach_messages_user_id_created_at on public.coach_messages (user_id, created_at asc);

-- ============================================================
-- ADD unit_system COLUMN
-- ============================================================
alter table public.physical_profiles
  add column if not exists unit_system text default 'metric';
