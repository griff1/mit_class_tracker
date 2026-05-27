-- city_coords: cached lat/lng for every city seen on a profile, so the home
-- map no longer requires a code edit per new city.
--
-- Flow: updateProfile schedules a post-response after() task that, for any
-- newly-saved city not already cached, calls Nominatim and upserts the
-- result via cache_city_coords (a SECURITY DEFINER function — writes don't
-- need an INSERT RLS policy, only the function is grantable). Negative
-- cache: lat/lng nullable so geocoder misses (typos, ambiguous strings)
-- are remembered and retried after 7 days (TTL enforced in app code, not
-- SQL).
--
-- The seed backfill replaces the previous hardcoded src/lib/cities-geo.ts
-- table — single source of truth moves to the DB. Authenticated reads
-- only; no INSERT/UPDATE/DELETE policy means anon and authenticated have
-- no direct write path, only the explicit cache_city_coords function call.

create table public.city_coords (
  city_key      text primary key,                       -- lower(trim(city))
  city_label    text,                                   -- canonical display
  lat           double precision,                       -- null = negative cache
  lng           double precision,
  source        text not null check (source in ('seed', 'nominatim')),
  geocoded_at   timestamptz not null default now()
);

alter table public.city_coords enable row level security;

create policy "Authenticated can read city coords"
  on public.city_coords
  for select
  to authenticated
  using (true);

-- "Automatically expose new tables" is off, so privileges must be granted
-- explicitly. authenticated reads; no anon access.
grant select on public.city_coords to authenticated;

create or replace function public.cache_city_coords(
  p_key text,
  p_label text,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  norm_key text := lower(trim(coalesce(p_key, '')));
begin
  if norm_key = '' then
    return;
  end if;
  insert into public.city_coords (city_key, city_label, lat, lng, source, geocoded_at)
  values (norm_key, p_label, p_lat, p_lng, 'nominatim', now())
  on conflict (city_key) do update
    set lat         = excluded.lat,
        lng         = excluded.lng,
        city_label  = coalesce(excluded.city_label, public.city_coords.city_label),
        source      = excluded.source,
        geocoded_at = excluded.geocoded_at;
end;
$$;

grant execute on function public.cache_city_coords(text, text, double precision, double precision)
  to authenticated;
revoke execute on function public.cache_city_coords(text, text, double precision, double precision)
  from public, anon;

-- Seed: backfill from the previous hardcoded lookup so day-1 behavior is
-- identical and src/lib/cities-geo.ts can be deleted.
insert into public.city_coords (city_key, city_label, lat, lng, source) values
  ('atlanta, ga',              'Atlanta, GA',              33.749,    -84.388,   'seed'),
  ('austin, tx',               'Austin, TX',               30.2672,   -97.7431,  'seed'),
  ('bangalore, india',         'Bangalore, India',         12.9716,    77.5946,  'seed'),
  ('beijing, china',           'Beijing, China',           39.9042,   116.4074,  'seed'),
  ('belgrade, serbia',         'Belgrade, Serbia',         44.7866,    20.4489,  'seed'),
  ('berlin, germany',          'Berlin, Germany',          52.52,      13.405,   'seed'),
  ('boston, ma',               'Boston, MA',               42.3601,   -71.0589,  'seed'),
  ('buenos aires, argentina',  'Buenos Aires, Argentina', -34.6037,   -58.3816,  'seed'),
  ('chicago, il',              'Chicago, IL',              41.8781,   -87.6298,  'seed'),
  ('dubai, uae',               'Dubai, UAE',               25.2048,    55.2708,  'seed'),
  ('hong kong',                'Hong Kong',                22.3193,   114.1694,  'seed'),
  ('houston, tx',              'Houston, TX',              29.7604,   -95.3698,  'seed'),
  ('london, uk',               'London, UK',               51.5074,    -0.1278,  'seed'),
  ('los angeles, ca',          'Los Angeles, CA',          34.0522,  -118.2437,  'seed'),
  ('mexico city, mexico',      'Mexico City, Mexico',      19.4326,   -99.1332,  'seed'),
  ('miami, fl',                'Miami, FL',                25.7617,   -80.1918,  'seed'),
  ('mumbai, india',            'Mumbai, India',            19.076,     72.8777,  'seed'),
  ('new york, ny',             'New York, NY',             40.7128,   -74.006,   'seed'),
  ('paris, france',            'Paris, France',            48.8566,     2.3522,  'seed'),
  ('san francisco, ca',        'San Francisco, CA',        37.7749,  -122.4194,  'seed'),
  ('são paulo, brazil',        'São Paulo, Brazil',       -23.5505,   -46.6333,  'seed'),
  ('seattle, wa',              'Seattle, WA',              47.6062,  -122.3321,  'seed'),
  ('seoul, south korea',       'Seoul, South Korea',       37.5665,   126.978,   'seed'),
  ('shanghai, china',          'Shanghai, China',          31.2304,   121.4737,  'seed'),
  ('singapore',                'Singapore',                 1.3521,   103.8198,  'seed'),
  ('sydney, australia',        'Sydney, Australia',       -33.8688,   151.2093,  'seed'),
  ('tel aviv, israel',         'Tel Aviv, Israel',         32.0853,    34.7818,  'seed'),
  ('tokyo, japan',             'Tokyo, Japan',             35.6762,   139.6503,  'seed'),
  ('toronto, canada',          'Toronto, Canada',          43.6532,   -79.3832,  'seed'),
  ('washington, dc',           'Washington, DC',           38.9072,   -77.0369,  'seed');
