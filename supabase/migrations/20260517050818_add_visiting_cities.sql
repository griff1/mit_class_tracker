-- profiles.visiting_cities: cities the member frequently travels to (work or
-- otherwise), distinct from `cities` (where they live). Same shape as `cities`:
-- text[] with the add-new + server-side resolveCanonical dedup pattern,
-- GIN-indexed for the directory array-overlap filter, aggregated on the home
-- map under a separate "Frequently visits" toggle.
--
-- Brand-new column (no prior single-value column to backfill from). Existing
-- rows default to an empty array. Table-level grants already cover new
-- columns; RLS is row-level and unaffected.

alter table public.profiles
  add column visiting_cities text[] not null default '{}';

create index profiles_visiting_cities_idx
  on public.profiles
  using gin (visiting_cities);
