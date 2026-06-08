-- Map-only metro grouping: the home map collapses SF / Peninsula / South Bay /
-- East Bay cities onto a single "Bay Area, CA" pin (see METRO_OF in
-- src/app/page.tsx). That hub label is never a raw profile city, so nothing
-- geocodes it in the background -- seed its coords here, exactly as migration
-- 20260529165923 pre-seeded "cambridge, ma". Without this row the Bay Area
-- bucket falls into the map's "not yet pinned" disclosure instead of pinning.
--
-- Coordinates anchor on San Francisco, the recognizable hub for the metro.
-- Directory cards and stats are unaffected -- only the map merges; each member
-- keeps their actual city everywhere else.
insert into public.city_coords (city_key, city_label, lat, lng, source)
values ('bay area, ca', 'Bay Area, CA', 37.7749, -122.4194, 'seed')
on conflict (city_key) do update
  set lat         = excluded.lat,
      lng         = excluded.lng,
      city_label  = excluded.city_label,
      source      = excluded.source,
      geocoded_at = now();
