create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  keys_p256dh text not null,
  keys_auth text not null,
  created_at timestamp with time zone default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage their own push_subscriptions."
  on public.push_subscriptions for all using (auth.uid() = user_id);

create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions (user_id);
