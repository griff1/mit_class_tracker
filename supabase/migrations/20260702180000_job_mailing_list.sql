-- Opt-in mailing list for new job postings. Each member chooses off / instant
-- (emailed when a posting is approved) / weekly (a Monday digest).
--
--   - 'instant' delivery happens in the reviewJob approve path: the admin has
--     an authenticated session that can read subscriber emails, so no special
--     access is needed.
--   - 'weekly' delivery runs from a Vercel Cron with NO user session, so it
--     goes through the secret-gated job_digest_batch() SECURITY DEFINER RPC
--     below. This keeps the "no service-role key in the app" posture intact.

-- Per-member preference. App-enforced allow-list (off/instant/weekly), no DB
-- CHECK -- same posture as ocean/program, extendable in code. Covered by the
-- existing profiles grants + self-update RLS policy, so members set their own.
alter table public.profiles
  add column if not exists job_alert_frequency text not null default 'off';

-- Partial index: the two delivery queries only ever scan opted-in members.
create index if not exists profiles_job_alert_frequency_idx
  on public.profiles (job_alert_frequency)
  where job_alert_frequency <> 'off';

-- Secret store for unauthenticated server-to-server calls (the cron). RLS on,
-- NO policies / NO grants -> unreachable via the Data API. Only SECURITY
-- DEFINER functions (which bypass RLS as table owner) read it. Same posture as
-- the `admins` table. The secret VALUE is inserted out-of-band (not in git):
--   insert into public.app_secrets (name, value) values ('job_digest', '<secret>');
-- and the same value goes in the Vercel CRON_SECRET env var.
create table if not exists public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;

-- Secret-gated digest batch. Returns the weekly subscribers' emails + the past
-- 7 days of approved postings, but ONLY when p_secret matches the stored
-- secret. Anyone may call it (it's granted to anon so the cron's anon-key
-- client can reach it), but without the secret it returns {"ok": false} and
-- leaks nothing. Prefer personal_email, fall back to the MIT address.
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

  select coalesce(jsonb_agg(distinct email), '[]'::jsonb)
    into v_recipients
    from (
      select coalesce(personal_email, mit_email) as email
      from public.profiles
      where job_alert_frequency = 'weekly'
    ) s
    where email is not null;

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
