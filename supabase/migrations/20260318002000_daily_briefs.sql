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

alter table public.daily_briefs enable row level security;

create policy "Users can manage their own daily_briefs."
  on public.daily_briefs for all using (auth.uid() = user_id);

create index if not exists idx_daily_briefs_user_date
  on public.daily_briefs (user_id, brief_date desc);
