-- Detect a "stranded MIT email" sign-in attempt early.
--
-- profiles.mit_email is preserved when a user transitions their auth email to
-- their personal address, so the MIT email is permanently squatted by their
-- original profile via the UNIQUE constraint. If they later (or someone else)
-- types that MIT email at /sign-in, signInWithOtp treats it as a brand-new
-- signup, the before_user_created hook ALLOWS it (it is a valid @mit.edu),
-- GoTrue sends the Confirm-signup code, and then the on_auth_user_confirmed
-- trigger trips profiles.mit_email UNIQUE -- verifyOtp rolls back and the
-- user sees a useless "invalid code" message. requestLoginCode pre-checks
-- this function and surfaces a clear "use your personal email" error
-- instead.
--
-- SECURITY DEFINER so the anon role can call it (the /sign-in path is
-- unauthenticated). Returns boolean only -- no PII beyond yes/no per typed
-- email. Mild email-enumeration trade-off accepted given the cohort is a
-- known, small, published class. Grants are explicit and minimal.

create or replace function public.is_replaced_mit_email(email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  norm text := lower(coalesce(email, ''));
begin
  if norm = '' then
    return false;
  end if;
  return exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(p.mit_email) = norm
      and lower(coalesce(u.email, '')) <> norm
  );
end;
$$;

grant execute on function public.is_replaced_mit_email(text) to anon, authenticated;
revoke execute on function public.is_replaced_mit_email(text) from public;
