-- Add the user's MIT program (MBA / LGO / SFMBA / EMBA / MFin / MBAn / MSMS /
-- PhD / UGrad) to profiles. Plain text column, allow-list enforced in the app
-- (updateProfile -> oneOfOrNull), matching the existing posture for `ocean`.
-- Btree index supports the directory's single-value `.eq("program", ...)`
-- filter the same way profiles_ocean_idx does.
--
-- Table-level grants on public.profiles already cover the new column for the
-- authenticated role (see 20260513180000_init.sql).

alter table public.profiles
  add column program text;

create index profiles_program_idx on public.profiles (program);
