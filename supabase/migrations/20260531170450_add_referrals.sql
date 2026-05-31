-- Referrals feature: any signed-in member can invite an MIT-domain email,
-- and when that email confirms their own signup, every matching referral
-- auto-completes (one referrer can only invite a given email once, but
-- many distinct referrers can invite the same person and all of them are
-- credited when they join).
--
-- Tables:
--   public.referrals  -- one row per (referrer, invited email) pair
--
-- Functions:
--   public.is_registered_mit_email(text) bool
--       Used by the send action to short-circuit referrals to people who
--       already joined. SECURITY DEFINER so the authed role can call it
--       without read access to auth.users; checks public.profiles
--       (the only "joined and confirmed" table).
--   public.referral_leaderboard(int) table(...)
--       Aggregate referral counts per referrer for the public leaderboard.
--       SECURITY DEFINER so we can join referrals + profiles without
--       per-row select grants on referrals (the table is RLS-restricted to
--       the referrer themselves, so an authed user can normally see only
--       their own rows). The function returns only (name, totals) -- no
--       referred-email leakage.
--   public.redeem_referral_code(text) bool
--       Called by verifyEmailOtp after a successful first-time signup.
--       Validates that (1) the calling user's profile was just created,
--       (2) they have not already been credited to another referral, and
--       (3) the code's referred_email matches their auth email. On all
--       three, marks that single referral complete. Returns false on any
--       failed check so the sign-in flow stays unblocked.
--
-- Credit attribution model: by code, NOT by email match. A referral is
-- completed only when its specific code arrives via the redeem RPC during
-- a fresh signup. If A and B both invite X, only the code X actually
-- used gets credit; the other stays pending forever.

create table public.referrals (
  id               uuid primary key default gen_random_uuid(),
  referrer_id      uuid not null references public.profiles(id) on delete cascade,
  referred_email   text not null,
  referral_code    text not null unique,
  email_sent_at    timestamptz not null default now(),
  completed_at     timestamptz,
  completed_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- One referrer can only invite a given email once. lower() so casing does
-- not bypass the constraint.
create unique index referrals_referrer_email_uidx
  on public.referrals (referrer_id, lower(referred_email));

-- Hot path for completion: look up by lower(email).
create index referrals_referred_email_idx
  on public.referrals (lower(referred_email));

-- Each user can be credited to at most one referral. Guards against a
-- fresh signup's redeem RPC racing with itself (e.g. a double-submit) and
-- against any future code path that would otherwise be tempted to credit
-- a second referrer for the same person.
create unique index referrals_completed_by_uidx
  on public.referrals (completed_by)
  where completed_by is not null;

alter table public.referrals enable row level security;

-- A user sees only the referrals they themselves sent. The leaderboard
-- (cross-cohort aggregate) goes through a SECURITY DEFINER function below,
-- so we do not need to widen this policy.
create policy "Users select own sent referrals"
  on public.referrals
  for select
  to authenticated
  using (referrer_id = (select auth.uid()));

-- Insert constrained to referrer_id = auth.uid() so a user cannot pretend
-- to send on someone else's behalf.
create policy "Users insert own referrals"
  on public.referrals
  for insert
  to authenticated
  with check (referrer_id = (select auth.uid()));

-- No app-side update or delete. Completion is done by the trigger
-- (security definer), not by the user.

grant select, insert on public.referrals to authenticated;

-- ------------------------------------------------------------------------ --
-- is_registered_mit_email: has this MIT email already joined the cohort?
-- ------------------------------------------------------------------------ --
create or replace function public.is_registered_mit_email(p_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists(
    select 1
    from public.profiles
    where lower(mit_email) = lower(coalesce(p_email, ''))
  );
$$;

grant execute on function public.is_registered_mit_email(text) to authenticated;
revoke execute on function public.is_registered_mit_email(text) from public, anon;

-- ------------------------------------------------------------------------ --
-- referral_leaderboard: top-N referrers by completed count.
-- Includes anyone who has sent at least one referral. Order: completed
-- desc, then total_sent desc, then name asc (stable last-resort tiebreak).
-- ------------------------------------------------------------------------ --
create or replace function public.referral_leaderboard(p_limit integer default 20)
returns table (
  profile_id  uuid,
  name        text,
  total_sent  integer,
  completed   integer
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.id                                            as profile_id,
    coalesce(nullif(trim(p.name), ''), p.mit_email) as name,
    count(r.id)::int                                as total_sent,
    count(r.completed_at)::int                      as completed
  from public.referrals r
  join public.profiles p on p.id = r.referrer_id
  group by p.id, p.name, p.mit_email
  having count(r.id) > 0
  order by completed desc, total_sent desc, name asc
  limit greatest(coalesce(p_limit, 20), 1);
$$;

grant execute on function public.referral_leaderboard(integer) to authenticated;
revoke execute on function public.referral_leaderboard(integer) from public, anon;

-- ------------------------------------------------------------------------ --
-- redeem_referral_code: complete the one referral matching the given code
-- iff (1) the calling user's profile was created in the last 15 minutes
-- (signup window only -- no retroactive credit when a returning user
-- happens to click an old invite link), (2) the user has not already been
-- credited to another referral, and (3) the code's referred_email matches
-- the calling user's auth email (so a guessed code can't be claimed by
-- the wrong person). Returns true on success, false on any failed check.
--
-- Called from verifyEmailOtp after the OTP verifies and the session is
-- live. Sign-in does not depend on this -- a false return is silent and
-- never surfaces an error to the user.
-- ------------------------------------------------------------------------ --
create or replace function public.redeem_referral_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id          uuid := auth.uid();
  v_user_email       text;
  v_profile_created  timestamptz;
  v_referral_id      uuid;
  v_referred_email   text;
begin
  if v_user_id is null or coalesce(p_code, '') = '' then
    return false;
  end if;

  -- (1) Fresh-signup window. 15 minutes covers a slow OTP entry plus a
  -- couple of retries; outside it, the user is "returning" and no credit
  -- should accrue regardless of which link they clicked.
  select created_at into v_profile_created
  from public.profiles where id = v_user_id;
  if v_profile_created is null
     or v_profile_created < now() - interval '15 minutes' then
    return false;
  end if;

  -- (2) Already credited? The UNIQUE partial index also guards the UPDATE
  -- below, but checking up-front lets us return cleanly without an
  -- exception. One credit per user, ever.
  if exists(
    select 1 from public.referrals where completed_by = v_user_id
  ) then
    return false;
  end if;

  -- Look up the code. Must still be pending.
  select id, lower(referred_email)
    into v_referral_id, v_referred_email
  from public.referrals
  where referral_code = p_code
    and completed_at is null;
  if v_referral_id is null then
    return false;
  end if;

  -- (3) Code's email must match the redeeming user. Without this check,
  -- knowing a code (e.g. from a leaked URL) would let any new signup
  -- claim it.
  select lower(coalesce(email, '')) into v_user_email
  from auth.users where id = v_user_id;
  if v_referred_email <> v_user_email then
    return false;
  end if;

  update public.referrals
     set completed_at = now(),
         completed_by = v_user_id
   where id = v_referral_id
     and completed_at is null;

  return true;
end;
$$;

grant execute on function public.redeem_referral_code(text) to authenticated;
revoke execute on function public.redeem_referral_code(text) from public, anon;

-- ------------------------------------------------------------------------ --
-- referrer_name_for_code: cheap unauth-callable lookup for the sign-in
-- page's "XYZ is inviting you to join Sloanopedia" banner. Returns NULL
-- when the code is unknown or already redeemed (don't keep advertising a
-- completed invite). Granted to anon AND authenticated because the sign-in
-- page is reached without a session.
--
-- Privacy: codes are random 16-hex (2^64), so only someone who already
-- has the invite link can resolve a name. Returns only the display name
-- (or NULL) -- no mit_email, no referrer_id, no referred_email leakage.
-- ------------------------------------------------------------------------ --
create or replace function public.referrer_name_for_code(p_code text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(nullif(trim(p.name), ''), 'A classmate')
  from public.referrals r
  join public.profiles p on p.id = r.referrer_id
  where r.referral_code = p_code
    and r.completed_at is null
  limit 1;
$$;

grant execute on function public.referrer_name_for_code(text) to anon, authenticated;
