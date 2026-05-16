-- SECURITY FIX. The Before User Created hook uses a DIFFERENT response
-- contract than the MFA/password hooks. It rejects with an `error` object
-- and allows with an empty object `{}`. Our original function returned
-- `{"decision":"reject"}` / `{"decision":"continue"}` (the MFA-hook shape),
-- which Supabase does not recognize as a rejection — so it proceeded with
-- user creation and ANY email could sign up (fail-open).
--
-- Authoritative contract:
--   https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
--   reject  -> { "error": { "http_code": <4xx>, "message": "..." } }
--   allow   -> {}
--
-- Real payload puts the email at event->'user'->>'email'. We lead with that
-- path and keep the old fallbacks defensively.

create or replace function public.before_user_created_check_mit_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text;
begin
  user_email := lower(coalesce(
    event #>> '{user,email}',
    event #>> '{user_metadata,email}',
    event #>> '{claims,email}',
    event #>> '{email}'
  ));

  if user_email is null or user_email = '' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'An email address is required to sign up.'
      )
    );
  end if;

  if
    user_email not like '%@mit.edu'
    and user_email not like '%@alum.mit.edu'
  then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message',
        'Sign-up is restricted to @mit.edu or @alum.mit.edu email addresses.'
      )
    );
  end if;

  -- Empty object = allow.
  return '{}'::jsonb;
end;
$$;

grant execute on function public.before_user_created_check_mit_domain to supabase_auth_admin;
revoke execute on function public.before_user_created_check_mit_domain from public, anon, authenticated;
