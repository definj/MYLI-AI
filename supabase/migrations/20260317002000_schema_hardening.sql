do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'physical_profiles_activity_level_check'
  ) then
    alter table public.physical_profiles
      add constraint physical_profiles_activity_level_check
      check (activity_level in ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'physical_profiles_goal_check'
  ) then
    alter table public.physical_profiles
      add constraint physical_profiles_goal_check
      check (goal in ('lose_fat', 'build_muscle', 'improve_endurance', 'maintain', 'recomposition'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'daily_tasks_priority_check'
  ) then
    alter table public.daily_tasks
      add constraint daily_tasks_priority_check
      check (priority in ('low', 'medium', 'high', 'critical'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'daily_tasks_category_check'
  ) then
    alter table public.daily_tasks
      add constraint daily_tasks_category_check
      check (category in ('work', 'health', 'personal', 'finance', 'relationships', 'creative'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'feed_posts_visibility_check'
  ) then
    alter table public.feed_posts
      add constraint feed_posts_visibility_check
      check (visibility in ('public', 'followers', 'private'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'social_connections_no_self_follow'
  ) then
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
