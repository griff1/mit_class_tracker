-- Revert the temporary diagnostic probe
-- (20260516184752_probe_before_user_created_invocation.sql).
--
-- The probe answered its question: the before_user_created hook DOES fire and
-- reject correctly for magic-link signups. The earlier "non-MIT could sign up"
-- symptom was simply that the contract-fix migration
-- (20260516182711_fix_before_user_created_contract.sql) had not actually been
-- applied to prod yet. Once applied, the gate works.
--
-- This migration is append-only cleanup (we do not delete the probe migration
-- file, since it may already have been applied): it removes the audit table and
-- restores the function to the clean, non-instrumented version — byte-for-byte
-- the same body as 20260516182711. Idempotent and correct whether or not the
-- probe ever reached prod.

drop table if exists public._auth_hook_audit;

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
