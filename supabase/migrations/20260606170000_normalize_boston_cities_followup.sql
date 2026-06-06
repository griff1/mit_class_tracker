-- Follow-up backfill: re-normalize bare "Boston" city tags to the canonical
-- "Boston, MA". The original cleanup (20260529165923) was one-time, but members
-- have kept typing "Boston" since, so the bare form has re-accumulated and again
-- shows up as a separate map pin / directory chip from "Boston, MA".
--
-- The durable fix ships alongside this in the frontend: the profile city picker
-- now surfaces existing partial matches as you type and steers write-ins onto
-- the canonical entry. This migration just sweeps up the rows that drifted
-- before that landed. Idempotent and safe to re-run.
--
-- Scope is intentionally Boston-only (the reported case). Cambridge was handled
-- in the prior migration; extend the CASE here if other bare-city tags recur.

-- 1. Rename within `cities`.
update public.profiles
set cities = (
  select array_agg(
    case when lower(trim(c)) = 'boston' then 'Boston, MA' else c end
  )
  from unnest(cities) c
)
where exists (
  select 1 from unnest(cities) c where lower(trim(c)) = 'boston'
);

-- 2. Same for `visiting_cities`.
update public.profiles
set visiting_cities = (
  select array_agg(
    case when lower(trim(c)) = 'boston' then 'Boston, MA' else c end
  )
  from unnest(visiting_cities) c
)
where exists (
  select 1 from unnest(visiting_cities) c where lower(trim(c)) = 'boston'
);

-- 3. Dedupe within each row (a profile that had both "Boston" and "Boston, MA"
-- now has a duplicate). Array order may shift; the UI sorts/joins for display,
-- so order is not semantically meaningful.
update public.profiles
set cities = array(select distinct unnest(cities))
where cities is not null
  and array_length(cities, 1)
      is distinct from cardinality(array(select distinct unnest(cities)));

update public.profiles
set visiting_cities = array(select distinct unnest(visiting_cities))
where visiting_cities is not null
  and array_length(visiting_cities, 1)
      is distinct from cardinality(array(select distinct unnest(visiting_cities)));

-- 4. Drop the orphaned 'boston' coords row if a background geocode re-created it
-- after a bare "Boston" save. No profile references it once step 1 runs, and
-- "Boston, MA" carries its own ('boston, ma') cache entry.
delete from public.city_coords where city_key = 'boston';
