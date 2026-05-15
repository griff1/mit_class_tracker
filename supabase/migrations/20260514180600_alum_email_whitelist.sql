-- Allow @alum.mit.edu in addition to @mit.edu so Sloan alumni who've already
-- migrated to their lifetime alumni email can sign up. The check stays in
-- the Auth Hook (DB layer is the only domain gate per the security-review
-- decision); CREATE OR REPLACE keeps the existing function bound to the hook.

create or replace function public.before_user_created_check_mit_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_email text;
begin
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

  if
    lower(user_email) not like '%@mit.edu'
    and lower(user_email) not like '%@alum.mit.edu'
  then
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Sign-up is restricted to @mit.edu or @alum.mit.edu email addresses.'
    );
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;
