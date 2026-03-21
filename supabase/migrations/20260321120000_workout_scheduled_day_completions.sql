-- Track "completed" for scheduled plan days (separate from workout_logs)
create table if not exists public.workout_scheduled_day_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.workout_scheduled_day_completions enable row level security;

drop policy if exists "Users manage own scheduled day completions." on public.workout_scheduled_day_completions;
create policy "Users manage own scheduled day completions."
  on public.workout_scheduled_day_completions for all
  using (auth.uid() = user_id);

create index if not exists idx_workout_scheduled_day_completions_user_date
  on public.workout_scheduled_day_completions (user_id, date);
