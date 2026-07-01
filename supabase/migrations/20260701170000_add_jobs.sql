-- Jobs board: member-submitted postings, admin-reviewed before going live.
--
-- Access model (DB-enforced, not just UI):
--   - Any authenticated member can INSERT a posting; it lands as 'pending'
--     (the insert policy forces both posted_by = self and status = 'pending',
--     so nobody can self-approve by direct REST).
--   - Everyone sees APPROVED postings. Posters additionally see their own
--     rows in any status (so the "your submissions" list can show
--     pending/rejected). Admins see everything.
--   - Only admins can UPDATE (approve / reject). Posters can delete their
--     own rows; admins can delete any.
--
-- Admin identity lives in an `admins` table, checked via the SECURITY DEFINER
-- `is_admin()` (same posture as the other definer fns in this schema: returns
-- a boolean only, granted to authenticated). The table itself has RLS enabled
-- and NO policies / NO grants -- it is not reachable through the Data API;
-- only the definer function reads it.

create table public.admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where profile_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Seed the reviewing admin (Griff). Keyed on the historical sign-up address,
-- which never changes even after the alumni email transition moves the
-- auth identity to a personal address.
insert into public.admins (profile_id)
select id from public.profiles where lower(mit_email) = 'potrock@mit.edu'
on conflict (profile_id) do nothing;

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  company text not null,
  location text,
  apply_url text,
  contact text,
  description text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Feed + review queue both order by recency within a status.
create index job_postings_status_created_idx
  on public.job_postings (status, created_at desc);

alter table public.job_postings enable row level security;

-- Project setting "automatically expose new tables" is OFF, so grants are
-- explicit (see CLAUDE.md). No anon access -- members only.
grant select, insert, update, delete on public.job_postings to authenticated;

create policy job_postings_select on public.job_postings
  for select to authenticated
  using (status = 'approved' or posted_by = auth.uid() or public.is_admin());

create policy job_postings_insert on public.job_postings
  for insert to authenticated
  with check (posted_by = auth.uid() and status = 'pending');

create policy job_postings_update on public.job_postings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy job_postings_delete on public.job_postings
  for delete to authenticated
  using (posted_by = auth.uid() or public.is_admin());
