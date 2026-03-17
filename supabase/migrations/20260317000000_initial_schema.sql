-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
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

-- PHYSICAL PROFILES
create table public.physical_profiles (
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

-- MENTAL PROFILES
create table public.mental_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  stress_sources text[],
  sleep_avg numeric,
  productivity_style text,
  life_areas text[]
);

-- MEAL LOGS
create table public.meal_logs (
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

-- VITAMIN ANALYSIS
create table public.vitamin_analysis (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  generated_at timestamp with time zone default now(),
  deficiencies jsonb,
  recommendations jsonb,
  meal_log_ids uuid[]
);

-- WORKOUT PLANS
create table public.workout_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  intensity text,
  plan_json jsonb,
  generated_at timestamp with time zone default now(),
  active boolean default true
);

-- WORKOUT LOGS
create table public.workout_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date default current_date,
  exercises jsonb,
  duration_min integer,
  completed boolean default false,
  notes text
);

-- DAILY TASKS
create table public.daily_tasks (
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

-- STREAKS
create table public.streaks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  streak_type text not null,
  current_count integer default 0,
  longest_count integer default 0,
  last_date date
);

-- SOCIAL CONNECTIONS
create table public.social_connections (
  id uuid primary key default uuid_generate_v4(),
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique(follower_id, following_id)
);

-- FEED POSTS
create table public.feed_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content_type text not null,
  content jsonb,
  visibility text default 'public',
  likes_count integer default 0,
  comments_count integer default 0,
  created_at timestamp with time zone default now()
);

-- ENABLE ROW LEVEL SECURITY
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

-- CREATE RLS POLICIES
-- Profiles: user can read/write their own profile, anyone can read public fields.
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = user_id);

-- Own data access only
create policy "Users can manage their own physical_profiles." on public.physical_profiles for all using (auth.uid() = user_id);
create policy "Users can manage their own mental_profiles." on public.mental_profiles for all using (auth.uid() = user_id);
create policy "Users can manage their own meal_logs." on public.meal_logs for all using (auth.uid() = user_id);
create policy "Users can manage their own vitamin_analysis." on public.vitamin_analysis for all using (auth.uid() = user_id);
create policy "Users can manage their own workout_plans." on public.workout_plans for all using (auth.uid() = user_id);
create policy "Users can manage their own workout_logs." on public.workout_logs for all using (auth.uid() = user_id);
create policy "Users can manage their own daily_tasks." on public.daily_tasks for all using (auth.uid() = user_id);
create policy "Users can manage their own streaks." on public.streaks for all using (auth.uid() = user_id);

-- Social Connections: read all, insert/delete own
create policy "Social connections are viewable by everyone." on public.social_connections for select using (true);
create policy "Users can follow others." on public.social_connections for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow others." on public.social_connections for delete using (auth.uid() = follower_id);

-- Feed Posts: viewable if visibility='public' or owned by user. User manages own.
create policy "Feed posts are viewable by everyone if public." on public.feed_posts for select using (visibility = 'public' or auth.uid() = user_id);
create policy "Users can manage their own feed_posts." on public.feed_posts for all using (auth.uid() = user_id);

-- STORAGE BUCKETS
insert into storage.buckets (id, name, public) values ('meal_photos', 'meal_photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

create policy "Avatar images are publicly accessible." on storage.objects for select using (bucket_id = 'avatars');
create policy "Anyone can upload an avatar." on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "Users can update their avatars." on storage.objects for update using (auth.uid() = owner);

create policy "Meal photos are publicly accessible." on storage.objects for select using (bucket_id = 'meal_photos');
create policy "Authenticated users can upload meal photos." on storage.objects for insert with check (bucket_id = 'meal_photos' and auth.role() = 'authenticated');
create policy "Users can delete their own meal photos." on storage.objects for delete using (auth.uid() = owner);