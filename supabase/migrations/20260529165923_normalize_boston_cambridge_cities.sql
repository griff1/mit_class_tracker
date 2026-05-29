-- One-time cleanup of two location-tag inconsistencies on profiles:
--   1. "Boston" write-ins collide with the seeded "Boston, MA" canonical
--      form, producing two separate map pins / directory chips for what is
--      semantically one city.
--   2. "Cambridge" write-ins get geocoded by Nominatim to Cambridge,
--      England (the geographically prominent result). The cohort almost
--      certainly meant Cambridge, MA.
--
-- Fix: normalize case-insensitively for both forms across `cities` and
-- `visiting_cities`, dedupe within row (in case someone had both forms),
-- delete the stale city_coords entries (the wrongly-cached "cambridge"
-- maps to England; "boston" is orphaned by the rename), and pre-seed
-- "cambridge, ma" coords so the home map pins it immediately on next
-- render rather than waiting for the next profile save to trigger a
-- background geocode.
--
-- Ordering note: must run BEFORE the home map metro-grouping change ships,
-- otherwise the bare "Boston"/"Cambridge" strings would not match the
-- "Cambridge, MA" -> "Boston, MA" alias and would render as orphan pins.
-- App code is forward-compatible with rows that already contain the
-- canonical forms.

-- 1. Rename within `cities`.
update public.profiles
set cities = (
  select array_agg(
    case
      when lower(trim(c)) = 'boston' then 'Boston, MA'
      when lower(trim(c)) = 'cambridge' then 'Cambridge, MA'
      else c
    end
  )
  from unnest(cities) c
)
where exists (
  select 1 from unnest(cities) c
  where lower(trim(c)) in ('boston', 'cambridge')
);

-- 2. Same for `visiting_cities`.
update public.profiles
set visiting_cities = (
  select array_agg(
    case
      when lower(trim(c)) = 'boston' then 'Boston, MA'
      when lower(trim(c)) = 'cambridge' then 'Cambridge, MA'
      else c
    end
  )
  from unnest(visiting_cities) c
)
where exists (
  select 1 from unnest(visiting_cities) c
  where lower(trim(c)) in ('boston', 'cambridge')
);

-- 3. Dedupe within each row (the rename may have produced duplicates: a
-- profile that listed both "Boston" and "Boston, MA" should collapse to
-- one entry). Array order may shift; the UI joins with " . " and order is
-- not semantically meaningful.
update public.profiles
set cities = array(select distinct unnest(cities))
where cities is not null
  and array_length(cities, 1) is distinct from cardinality(array(select distinct unnest(cities)));

update public.profiles
set visiting_cities = array(select distinct unnest(visiting_cities))
where visiting_cities is not null
  and array_length(visiting_cities, 1) is distinct from cardinality(array(select distinct unnest(visiting_cities)));

-- 4. Drop stale city_coords entries.
--    'cambridge' -> previously cached at Cambridge, England.
--    'boston'    -> orphaned by step 1's rename; no city now references it.
delete from public.city_coords where city_key in ('boston', 'cambridge');

-- 5. Pre-seed Cambridge, MA so the map pins it on the next render without
-- waiting for the after() background geocode to fire on a profile save.
-- Coords are the city centroid (Cambridge City Hall area).
insert into public.city_coords (city_key, city_label, lat, lng, source)
values ('cambridge, ma', 'Cambridge, MA', 42.3736, -71.1097, 'seed')
on conflict (city_key) do update
  set lat         = excluded.lat,
      lng         = excluded.lng,
      city_label  = excluded.city_label,
      source      = excluded.source,
      geocoded_at = now();
