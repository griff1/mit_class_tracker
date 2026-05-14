export type Profile = {
  id: string;
  name: string | null;
  mit_email: string;
  personal_email: string | null;
  company: string | null;
  title: string | null;
  industries: string[];
  city: string | null;
  linkedin_url: string | null;
  profile_photo_url: string | null;
  ocean: string | null;
  created_at: string;
  updated_at: string;
};

export const INDUSTRIES = [
  "Tech",
  "Finance",
  "Consulting",
  "Healthcare",
  "Energy",
  "Government / Public Sector",
  "Nonprofit",
  "Education",
  "Retail / Consumer",
  "Manufacturing",
  "Media / Entertainment",
  "Real Estate",
  "Other",
] as const;

// MIT Sloan Class of 2026 cohort names.
export const OCEANS = [
  "Atlantic",
  "Baltic",
  "Caribbean",
  "Indian",
  "Mediterranean",
  "Pacific",
] as const;
