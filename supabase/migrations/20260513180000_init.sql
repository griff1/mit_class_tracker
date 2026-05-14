-- profiles: one row per class member, keyed to auth.users.
-- Created automatically on signup via a trigger on auth.users.
-- All reads require auth; updates restricted to the owning user.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  mit_email text not null unique,
  personal_email text,
  company text,
  title text,
  industry text,
  city text,
  linkedin_url text,
  profile_photo_url text,
  ocean text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_city_idx on public.profiles (city);
create index profiles_industry_idx on public.profiles (industry);
create index profiles_ocean_idx on public.profiles (ocean);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, mit_email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- RLS (the "Enable automatic RLS" event trigger should already have turned this on; explicit for clarity)
alter table public.profiles enable row level security;

create policy "Authenticated users can view all profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "Users can update only their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No INSERT policy: profile creation is handled exclusively by on_auth_user_created.
-- No DELETE policy: profile deletion happens via cascade on auth.users delete (admin action).

-- "Automatically expose new tables" is off, so privileges must be granted explicitly.
grant select, update on public.profiles to authenticated;
-- anon is deliberately not granted any access.
