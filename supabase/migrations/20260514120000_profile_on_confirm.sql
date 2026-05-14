-- Bug: the original on_auth_user_created trigger fired on INSERT into
-- auth.users, which happens *before* email confirmation. An unconfirmed
-- signup (e.g. fake@mit.edu) therefore got a profile row immediately and
-- showed up in the directory.
--
-- Fix: fire on UPDATE, specifically the NULL → non-NULL transition of
-- email_confirmed_at. That is exactly the moment "user proved they own this
-- email." This is the only point at which they become a real class member.

drop trigger if exists on_auth_user_created on auth.users;

-- Make the insert idempotent so theoretical re-fires (e.g. an admin clearing
-- and re-setting email_confirmed_at) don't error out.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, mit_email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_confirmed
  after update on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_user();

-- Clean up any profile rows that exist right now for unconfirmed users.
-- (The auth.users rows themselves are left in place; Supabase manages those.)
delete from public.profiles
  where id in (
    select id from auth.users where email_confirmed_at is null
  );
