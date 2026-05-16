-- ⚠️ TEMPORARY DIAGNOSTIC PROBE — remove after we've answered the question.
--
-- Question: does the before_user_created hook actually fire for
-- signInWithOtp / magic-link signups, or only for password/OAuth?
--
-- Method: the function writes one row to _auth_hook_audit on EVERY
-- invocation, then applies the (already-corrected) reject contract.
-- After a fresh gmail signup attempt on prod, inspect the table:
--
--   select * from public._auth_hook_audit order by called_at desc;
--
--   * row present, gmail user NOT created  -> hook fires + rejects (working)
--   * row present, gmail user WAS created  -> fires but reject not honored
--   * NO row, gmail user WAS created       -> hook never fires for OTP
--                                             (the real bug; fix = a
--                                             BEFORE INSERT trigger on
--                                             auth.users, method-agnostic)

create table if not exists public._auth_hook_audit (
  id bigint generated always as identity primary key,
  called_at timestamptz not null default now(),
  email text,
  decision text,
  raw_event jsonb
);

alter table public._auth_hook_audit enable row level security;
-- No policies + revoke: not reachable via Data API; only inspect via SQL editor.
revoke all on public._auth_hook_audit from anon, authenticated;

create or replace function public.before_user_created_check_mit_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text;
  result jsonb;
begin
  user_email := lower(coalesce(
    event #>> '{user,email}',
    event #>> '{user_metadata,email}',
    event #>> '{claims,email}',
    event #>> '{email}'
  ));

  if user_email is null or user_email = '' then
    result := jsonb_build_object('error', jsonb_build_object(
      'http_code', 400, 'message', 'An email address is required to sign up.'));
  elsif
    user_email not like '%@mit.edu'
    and user_email not like '%@alum.mit.edu'
  then
    result := jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message',
      'Sign-up is restricted to @mit.edu or @alum.mit.edu email addresses.'));
  else
    result := '{}'::jsonb;
  end if;

  insert into public._auth_hook_audit (email, decision, raw_event)
  values (
    user_email,
    case when result ? 'error' then 'reject' else 'allow' end,
    event
  );

  return result;
end;
$$;

grant execute on function public.before_user_created_check_mit_domain to supabase_auth_admin;
revoke execute on function public.before_user_created_check_mit_domain from public, anon, authenticated;
