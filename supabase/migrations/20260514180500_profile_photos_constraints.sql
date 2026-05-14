-- Bucket-level constraints on profile-photos.
--
-- Without these, the Server Action's 5MB + MIME validation is the only gate.
-- A cohort member could skip our action and upload directly via supabase-js
-- (RLS allows them to write to their own folder) with arbitrary size / MIME.
-- These constraints reject such requests at the Storage layer.

update storage.buckets
set
  file_size_limit = 5 * 1024 * 1024,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
where id = 'profile-photos';
