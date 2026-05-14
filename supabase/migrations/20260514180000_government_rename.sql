-- Rename the "Government / Public Sector" industry to just "Government" for
-- compactness in the directory filter rail. Any profile rows currently storing
-- the old long form would otherwise silently fall out of the allow-list and
-- appear blank in the directory.

update public.profiles
  set industries = array_replace(industries, 'Government / Public Sector', 'Government');
