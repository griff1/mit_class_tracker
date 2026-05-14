-- Auth Hook: reject signups from non-@mit.edu addresses at the auth layer,
-- so the server-side check in the sign-up Server Action has a database-level backstop.
--
-- AFTER applying this migration, the hook must be enabled in the Supabase Dashboard:
--   Authentication → Hooks → "Before User Created" → Postgres function →
--   schema: public, function: before_user_created_check_mit_domain
-- Until that toggle is flipped, the function exists but is never called.

create or replace function public.before_user_created_check_mit_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text;
begin
  -- The "Before User Created" event payload puts the user under `user_metadata` and `claims`,
  -- and also exposes the canonical email at the top of the user record. Try the most reliable
  -- locations in order.
  user_email := coalesce(
    event #>> '{user_metadata,email}',
    event #>> '{claims,email}',
    event #>> '{user,email}',
    event #>> '{email}'
  );

  if user_email is null or user_email = '' then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Email address is required.'
    );
  end if;

  if lower(user_email) not like '%@mit.edu' then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Sign-up is restricted to @mit.edu email addresses.'
    );
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;

-- Only supabase_auth_admin should invoke this; nobody else.
grant execute on function public.before_user_created_check_mit_domain to supabase_auth_admin;
revoke execute on function public.before_user_created_check_mit_domain from public, anon, authenticated;
