create table if not exists public.calendar_integrations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('google')),
  provider_account_email text,
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamp with time zone,
  connected_at timestamp with time zone default now(),
  last_synced_at timestamp with time zone,
  sync_error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (user_id, provider)
);

create table if not exists public.calendar_external_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('google')),
  provider_event_id text not null,
  calendar_id text,
  title text,
  description text,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  is_all_day boolean default false,
  status text,
  location text,
  html_link text,
  raw_event jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (user_id, provider, provider_event_id)
);

create index if not exists idx_calendar_integrations_user_provider
  on public.calendar_integrations (user_id, provider);

create index if not exists idx_calendar_events_user_time
  on public.calendar_external_events (user_id, start_at, end_at);

create index if not exists idx_calendar_events_provider
  on public.calendar_external_events (provider);

alter table public.calendar_integrations enable row level security;
alter table public.calendar_external_events enable row level security;

create policy "Users can manage their own calendar integrations."
  on public.calendar_integrations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own external calendar events."
  on public.calendar_external_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
