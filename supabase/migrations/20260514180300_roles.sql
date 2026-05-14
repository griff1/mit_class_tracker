-- Add roles — the functional roles (Product Manager, Software Engineer, etc.)
-- a member fills. Stored as a text[] following the cities / activities /
-- industries pattern, with a GIN index for array overlap filters.

alter table public.profiles
  add column roles text[] not null default '{}';

create index profiles_roles_idx
  on public.profiles
  using gin (roles);
