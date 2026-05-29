-- Also accept @sloan.mit.edu as a valid MIT-affiliated signup domain.
-- The LIKE clause '%@mit.edu' requires '@' immediately before 'mit.edu',
-- so '%@sloan.mit.edu' is a distinct case that must be listed explicitly.
-- Same shape and contract as the prior definition
-- (20260516185515_revert_auth_hook_probe.sql); only the allowed-domain list
-- and the rejection message change.

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
    and user_email not like '%@sloan.mit.edu'
    and user_email not like '%@alum.mit.edu'
  then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message',
        'Sign-up is restricted to @mit.edu, @sloan.mit.edu, or @alum.mit.edu email addresses.'
      )
    );
  end if;

  -- Empty object = allow.
  return '{}'::jsonb;
end;
$$;

grant execute on function public.before_user_created_check_mit_domain to supabase_auth_admin;
revoke execute on function public.before_user_created_check_mit_domain from public, anon, authenticated;
