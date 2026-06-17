-- Normalize two more location-tag collisions that recurred after the earlier
-- one-time cleanups. The durable fix ships alongside in app code: CITY_ALIASES
-- + accent-insensitive canonicalization in resolveCanonical (src/lib/cities.ts),
-- so future write-ins converge automatically. This sweeps up the existing rows.
--
--   1. Bare "Cambridge" (no ", MA") keeps appearing on fresh signups. Nominatim
--      resolves bare "cambridge" to Cambridge, ENGLAND, so those members pin in
--      the UK. Normalize to "Cambridge, MA".
--   2. "São Paulo" shows up under several forms -- accent vs none, with/without
--      ", Brazil"/", Brasil", and the "Paolo" misspelling -- as distinct cities,
--      because the dedup key was accent- and suffix-sensitive. Collapse to the
--      seed form "São Paulo, Brazil".
--
-- Idempotent and safe to re-run.

-- 1. Normalize within `cities`.
update public.profiles
set cities = (
  select array_agg(
    case
      when lower(trim(c)) in (
        'cambridge', 'cambridge, ma', 'cambridge ma', 'cambridge, massachusetts'
      ) then 'Cambridge, MA'
      when lower(trim(c)) in (
        'sao paulo', 'são paulo',
        'sao paulo, brazil', 'são paulo, brazil',
        'sao paulo, brasil', 'são paulo, brasil',
        'sao paolo', 'são paolo',
        'sao paolo, brazil', 'são paolo, brazil',
        'sao paolo, brasil', 'são paolo, brasil'
      ) then 'São Paulo, Brazil'
      else c
    end
  )
  from unnest(cities) c
)
where exists (
  select 1 from unnest(cities) c
  where lower(trim(c)) in (
    'cambridge', 'cambridge ma', 'cambridge, massachusetts',
    'sao paulo', 'são paulo',
    'sao paulo, brazil', 'sao paulo, brasil', 'são paulo, brasil',
    'sao paolo', 'são paolo',
    'sao paolo, brazil', 'são paolo, brazil',
    'sao paolo, brasil', 'são paolo, brasil'
  )
);

-- 2. Same for `visiting_cities`.
update public.profiles
set visiting_cities = (
  select array_agg(
    case
      when lower(trim(c)) in (
        'cambridge', 'cambridge, ma', 'cambridge ma', 'cambridge, massachusetts'
      ) then 'Cambridge, MA'
      when lower(trim(c)) in (
        'sao paulo', 'são paulo',
        'sao paulo, brazil', 'são paulo, brazil',
        'sao paulo, brasil', 'são paulo, brasil',
        'sao paolo', 'são paolo',
        'sao paolo, brazil', 'são paolo, brazil',
        'sao paolo, brasil', 'são paolo, brasil'
      ) then 'São Paulo, Brazil'
      else c
    end
  )
  from unnest(visiting_cities) c
)
where exists (
  select 1 from unnest(visiting_cities) c
  where lower(trim(c)) in (
    'cambridge', 'cambridge ma', 'cambridge, massachusetts',
    'sao paulo', 'são paulo',
    'sao paulo, brazil', 'sao paulo, brasil', 'são paulo, brasil',
    'sao paolo', 'são paolo',
    'sao paolo, brazil', 'são paolo, brazil',
    'sao paolo, brasil', 'são paolo, brasil'
  )
);

-- 3. Dedupe within each row (the normalization may have produced duplicates).
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

-- 4. Drop stale / wrong coords:
--    'cambridge' was cached at Cambridge, England (the bug). Delete the São
--    Paulo variant keys so only the canonical 'são paulo, brazil' remains.
delete from public.city_coords
where city_key in (
  'cambridge',
  'sao paulo',
  'sao paulo, brazil', 'sao paulo, brasil', 'são paulo, brasil',
  'sao paolo', 'são paolo',
  'sao paolo, brazil', 'são paolo, brazil',
  'sao paolo, brasil', 'são paolo, brasil'
);

-- 5. Seed São Paulo coords so the canonical entry pins on the next render
--    without waiting for a background geocode (city centroid).
insert into public.city_coords (city_key, city_label, lat, lng, source)
values ('são paulo, brazil', 'São Paulo, Brazil', -23.5505, -46.6333, 'seed')
on conflict (city_key) do update
  set lat         = excluded.lat,
      lng         = excluded.lng,
      city_label  = excluded.city_label,
      source      = excluded.source,
      geocoded_at = now();
