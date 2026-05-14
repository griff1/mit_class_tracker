-- profiles.industry (single text) → profiles.industries (text[]).
-- Members typically span multiple industries post-MBA; the directory needs to filter
-- on "any of the selected industries", which maps cleanly to a Postgres array + GIN index.

alter table public.profiles
  add column industries text[] not null default '{}';

-- Backfill: any existing single industry becomes a one-element array.
update public.profiles
  set industries = array[industry]
  where industry is not null and industry <> '';

drop index if exists public.profiles_industry_idx;
alter table public.profiles drop column industry;

-- GIN index supports the &&, @>, and <@ array operators used by the directory's
-- `.overlaps()` / `.contains()` filters.
create index profiles_industries_idx
  on public.profiles
  using gin (industries);
