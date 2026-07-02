-- Let the original poster (or an admin) mark an approved listing as filled
-- ("closed"), and reopen it. Closed listings drop out of the public feed --
-- the existing select policy only exposes 'approved' to other members, so a
-- 'closed' row is visible just to its poster (under "Your submissions") and
-- admins. No select-policy change needed.

-- 1. Extend the status domain.
alter table public.job_postings
  drop constraint if exists job_postings_status_check;
alter table public.job_postings
  add constraint job_postings_status_check
  check (status in ('pending', 'approved', 'rejected', 'closed'));

-- 2. Constrained toggle. Only the owner or an admin may call it, and only to
-- move between approved <-> closed -- a pending/rejected posting can't be
-- pushed live past review through this path. SECURITY DEFINER so it bypasses
-- the admin-only UPDATE policy while enforcing its own ownership check (same
-- posture as redeem_referral_code / is_admin). Returns false on any violation
-- so the caller never leaks whether a row exists.
create or replace function public.set_job_closed(p_id uuid, p_closed boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
begin
  select posted_by, status into v_owner, v_status
  from public.job_postings where id = p_id;
  if v_owner is null then
    return false;
  end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    return false;
  end if;
  if v_status not in ('approved', 'closed') then
    return false;
  end if;
  update public.job_postings
    set status = case when p_closed then 'closed' else 'approved' end
    where id = p_id;
  return true;
end;
$$;

revoke all on function public.set_job_closed(uuid, boolean) from public, anon;
grant execute on function public.set_job_closed(uuid, boolean) to authenticated;
