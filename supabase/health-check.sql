-- Pre-deploy sanity check. Run this against the Supabase project (Dashboard
-- SQL Editor, or `psql $SUPABASE_DB_URL -f supabase/health-check.sql`).
-- Every query should return `t` / a non-empty result.
--
-- It does NOT verify that the Auth Hook is *bound* in Authentication → Hooks
-- (that toggle is stored outside the public schema). To verify binding, also
-- spot-check the dashboard before relying on the @mit.edu gate.

-- ------------------------------------------------------------------------ --
-- 1. The Auth Hook function exists.
-- ------------------------------------------------------------------------ --
select
  exists(
    select 1 from pg_proc
    where proname = 'before_user_created_check_mit_domain'
      and pronamespace = 'public'::regnamespace
  ) as hook_function_exists;

-- ------------------------------------------------------------------------ --
-- 2. supabase_auth_admin has EXECUTE on the hook function.
--    (Without this, Supabase Auth can't call it and signups will fail open.)
-- ------------------------------------------------------------------------ --
select has_function_privilege(
  'supabase_auth_admin',
  'public.before_user_created_check_mit_domain(jsonb)',
  'EXECUTE'
) as auth_admin_can_execute;

-- ------------------------------------------------------------------------ --
-- 3. The function actually rejects non-@mit.edu emails.
--    Should return: {"decision": "reject", "message": "..."}.
-- ------------------------------------------------------------------------ --
select public.before_user_created_check_mit_domain(
  jsonb_build_object('user_metadata', jsonb_build_object('email', 'attacker@evil.com'))
) as rejects_non_mit;

-- ------------------------------------------------------------------------ --
-- 4. The function accepts @mit.edu emails.
--    Should return: {"decision": "continue"}.
-- ------------------------------------------------------------------------ --
select public.before_user_created_check_mit_domain(
  jsonb_build_object('user_metadata', jsonb_build_object('email', 'jane@mit.edu'))
) as accepts_mit;

-- ------------------------------------------------------------------------ --
-- 4b. The function accepts @alum.mit.edu emails.
--     Should return: {"decision": "continue"}.
-- ------------------------------------------------------------------------ --
select public.before_user_created_check_mit_domain(
  jsonb_build_object('user_metadata', jsonb_build_object('email', 'jane@alum.mit.edu'))
) as accepts_alum;

-- ------------------------------------------------------------------------ --
-- 5. The profile-row trigger exists and fires on the right transition.
-- ------------------------------------------------------------------------ --
select
  exists(
    select 1 from pg_trigger
    where tgname = 'on_auth_user_confirmed'
      and tgrelid = 'auth.users'::regclass
  ) as confirmed_trigger_exists;

-- ------------------------------------------------------------------------ --
-- 6. The profile-photos bucket exists with the constraints applied.
-- ------------------------------------------------------------------------ --
select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'profile-photos';
