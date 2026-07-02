-- One-click unsubscribe for the job mailing list (RFC 8058 List-Unsubscribe +
-- a clickable link in each email). Each recipient gets an unguessable token;
-- clicking/POSTing it flips their job_alert_frequency to 'off' without a login.
--
-- The token must NOT be readable by other members (else anyone could
-- unsubscribe anyone), so it lives in its own table with RLS on and NO
-- policies/grants -- API-unreachable, read only by the SECURITY DEFINER
-- functions below (which bypass RLS as table owner). Same posture as
-- admins / app_secrets.

create table if not exists public.job_alert_tokens (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);
alter table public.job_alert_tokens enable row level security;

-- Backfill existing members.
insert into public.job_alert_tokens (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

-- Mint a token for every newly-confirmed profile. SECURITY DEFINER so it can
-- write to the grant-less table regardless of who inserted the profile row.
create or replace function public.ensure_job_alert_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_alert_tokens (profile_id) values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists job_alert_token_after_profile_insert on public.profiles;
create trigger job_alert_token_after_profile_insert
  after insert on public.profiles
  for each row execute function public.ensure_job_alert_token();

-- Admin-only fetch of instant subscribers + their tokens, used by reviewJob to
-- build per-recipient emails. Returns nothing for non-admins.
create or replace function public.instant_job_subscribers()
returns table (email text, token uuid)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
    select coalesce(p.personal_email, p.mit_email) as email, t.token
    from public.profiles p
    join public.job_alert_tokens t on t.profile_id = p.id
    where p.job_alert_frequency = 'instant'
      and coalesce(p.personal_email, p.mit_email) is not null;
end;
$$;
revoke all on function public.instant_job_subscribers() from public, anon;
grant execute on function public.instant_job_subscribers() to authenticated;

-- Secret-gated weekly digest batch, now returning each recipient's token so the
-- cron can build per-recipient unsubscribe links. (Supersedes the version in
-- 20260702180000.)
create or replace function public.job_digest_batch(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
  v_recipients jsonb;
  v_jobs jsonb;
begin
  select value into v_expected from public.app_secrets where name = 'job_digest';
  if v_expected is null or p_secret is null or p_secret <> v_expected then
    return jsonb_build_object('ok', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'token', token)), '[]'::jsonb)
    into v_recipients
    from (
      select coalesce(p.personal_email, p.mit_email) as email, t.token
      from public.profiles p
      join public.job_alert_tokens t on t.profile_id = p.id
      where p.job_alert_frequency = 'weekly'
    ) s
    where s.email is not null;

  select coalesce(
           jsonb_agg(
             jsonb_build_object('title', title, 'company', company, 'location', location)
             order by created_at desc
           ),
           '[]'::jsonb
         )
    into v_jobs
    from public.job_postings
    where status = 'approved'
      and created_at >= now() - interval '7 days';

  return jsonb_build_object('ok', true, 'recipients', v_recipients, 'jobs', v_jobs);
end;
$$;

revoke all on function public.job_digest_batch(text) from public;
grant execute on function public.job_digest_batch(text) to anon, authenticated;

-- Unsubscribe by token. Anon-callable (the endpoint has no session) but the
-- token is the credential, so only its holder can turn off their own alerts.
create or replace function public.unsubscribe_job_alerts(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.profiles
    set job_alert_frequency = 'off'
    where id = (select profile_id from public.job_alert_tokens where token = p_token)
    returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.unsubscribe_job_alerts(uuid) from public;
grant execute on function public.unsubscribe_job_alerts(uuid) to anon, authenticated;
