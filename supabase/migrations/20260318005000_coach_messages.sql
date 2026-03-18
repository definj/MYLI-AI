create table if not exists public.coach_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamp with time zone default now()
);

alter table public.coach_messages enable row level security;

create policy "Users can manage their own coach_messages."
  on public.coach_messages for all using (auth.uid() = user_id);

create index if not exists idx_coach_messages_user_id_created_at
  on public.coach_messages (user_id, created_at asc);
