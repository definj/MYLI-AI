set search_path = public, extensions;

create table if not exists public.feed_post_likes (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.feed_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique (post_id, user_id)
);

create table if not exists public.feed_post_replies (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.feed_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  parent_reply_id uuid references public.feed_post_replies(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default now()
);

alter table public.feed_post_likes enable row level security;
alter table public.feed_post_replies enable row level security;

drop policy if exists "Users can manage their own feed_posts." on public.feed_posts;
drop policy if exists "Users can view their own likes." on public.feed_post_likes;
drop policy if exists "Users can like posts." on public.feed_post_likes;
drop policy if exists "Users can unlike posts." on public.feed_post_likes;
drop policy if exists "Replies are viewable by everyone." on public.feed_post_replies;
drop policy if exists "Users can create replies." on public.feed_post_replies;
drop policy if exists "Users can edit their replies." on public.feed_post_replies;
drop policy if exists "Users can delete their replies." on public.feed_post_replies;

create policy "Users can insert their own feed_posts."
  on public.feed_posts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own feed_posts."
  on public.feed_posts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own feed_posts."
  on public.feed_posts
  for delete
  using (auth.uid() = user_id);

create policy "Users can view their own likes."
  on public.feed_post_likes
  for select
  using (auth.uid() = user_id);

create policy "Users can like posts."
  on public.feed_post_likes
  for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike posts."
  on public.feed_post_likes
  for delete
  using (auth.uid() = user_id);

create policy "Replies are viewable by everyone."
  on public.feed_post_replies
  for select
  using (true);

create policy "Users can create replies."
  on public.feed_post_replies
  for insert
  with check (auth.uid() = user_id);

create policy "Users can edit their replies."
  on public.feed_post_replies
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their replies."
  on public.feed_post_replies
  for delete
  using (auth.uid() = user_id);

create index if not exists idx_feed_post_likes_post_id on public.feed_post_likes (post_id);
create index if not exists idx_feed_post_likes_user_id on public.feed_post_likes (user_id);
create index if not exists idx_feed_post_replies_post_id_created_at on public.feed_post_replies (post_id, created_at asc);
create index if not exists idx_feed_post_replies_parent_reply_id on public.feed_post_replies (parent_reply_id);

insert into storage.buckets (id, name, public)
values ('social_images', 'social_images', true)
on conflict (id) do nothing;

drop policy if exists "Social images are publicly accessible." on storage.objects;
drop policy if exists "Authenticated users can upload social images." on storage.objects;
drop policy if exists "Users can delete their own social images." on storage.objects;

create policy "Social images are publicly accessible."
  on storage.objects
  for select
  using (bucket_id = 'social_images');

create policy "Authenticated users can upload social images."
  on storage.objects
  for insert
  with check (bucket_id = 'social_images' and auth.role() = 'authenticated');

create policy "Users can delete their own social images."
  on storage.objects
  for delete
  using (bucket_id = 'social_images' and auth.uid() = owner);
