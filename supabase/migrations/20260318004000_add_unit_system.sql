-- Add unit_system column to physical_profiles
alter table public.physical_profiles
  add column if not exists unit_system text default 'metric';
