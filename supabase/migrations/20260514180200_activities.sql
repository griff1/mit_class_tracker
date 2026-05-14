-- Add activities — the Sloan extracurriculars / clubs / programs a member
-- participated in. Stored as a text[] following the cities/industries pattern,
-- with a GIN index for future array filters.

alter table public.profiles
  add column activities text[] not null default '{}';

create index profiles_activities_idx
  on public.profiles
  using gin (activities);
