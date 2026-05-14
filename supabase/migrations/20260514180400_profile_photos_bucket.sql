-- Profile photo storage: a private bucket where each user can only write to
-- their own `<user_id>/` folder, but any authenticated class member can read
-- every photo (the directory is intra-class-visible).

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

-- SELECT: any authenticated user can read any profile photo.
create policy "Authenticated users can read profile photos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'profile-photos');

-- INSERT: a user can only upload into the folder named by their own UUID.
-- `storage.foldername(name)` returns the path segments as an array; element 1
-- (1-indexed) is the top folder.
create policy "Users can upload their own profile photo"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- UPDATE: same constraint as INSERT. Needed because `upload()` with
-- `upsert: true` will fall back to UPDATE when the file already exists.
create policy "Users can update their own profile photo"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- DELETE: same constraint. Currently no UI path exercises this, but it's the
-- right shape if/when a "remove photo" affordance lands.
create policy "Users can delete their own profile photo"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
