create table if not exists public.user_achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  badge_key text not null,
  unlocked_at timestamp with time zone default now(),
  unique(user_id, badge_key)
);

alter table public.user_achievements enable row level security;

create policy "Users can manage their own achievements."
  on public.user_achievements for all using (auth.uid() = user_id);

create index if not exists idx_user_achievements_user_id on public.user_achievements (user_id);
