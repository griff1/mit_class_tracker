-- profiles.city (single text) → profiles.cities (text[]).
-- Same shape as industries: members can have multiple cities (e.g. NYC and
-- London), and the directory filters via Postgres array overlap.

alter table public.profiles
  add column cities text[] not null default '{}';

-- Backfill: any existing single city becomes a one-element array.
update public.profiles
  set cities = array[city]
  where city is not null and city <> '';

drop index if exists public.profiles_city_idx;
alter table public.profiles drop column city;

create index profiles_cities_idx
  on public.profiles
  using gin (cities);
