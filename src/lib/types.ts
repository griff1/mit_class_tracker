export type Profile = {
  id: string;
  name: string | null;
  mit_email: string;
  personal_email: string | null;
  company: string | null;
  title: string | null;
  industries: string[];
  roles: string[];
  cities: string[];
  visiting_cities: string[];
  linkedin_url: string | null;
  profile_photo_url: string | null;
  ocean: string | null;
  program: string | null;
  activities: string[];
  created_at: string;
  updated_at: string;
};

// Seed list for industries. Members can add new entries which then appear as
// chips for everyone in the cohort. Server-side `resolveCanonical` handles
// case-insensitive dedup against the cohort + this seed.
export const INDUSTRIES = [
  "Tech",
  "Finance",
  "Consulting",
  "Healthcare",
  "Energy",
  "Government",
  "Nonprofit",
  "Education",
  "Retail / Consumer",
  "Manufacturing",
  "Media / Entertainment",
  "Real Estate",
  "Other",
] as const;

// Seed list for functional roles. Same add-new pattern as industries / cities
// / activities.
export const ROLES = [
  "Business Analyst",
  "Consultant",
  "Data Scientist",
  "Designer",
  "Executive",
  "Finance",
  "Founder",
  "Investor",
  "Manager",
  "Marketing",
  "Operations",
  "Other",
  "Product Manager",
  "Program Manager",
  "Sales",
  "Software Engineer",
  "Strategy",
] as const;

// MIT Sloan Class of 2026 cohort names. Strict allow-list (no add-new).
export const OCEANS = [
  "Atlantic",
  "Baltic",
  "Caribbean",
  "Indian",
  "Mediterranean",
  "Pacific",
] as const;

// MIT degree programs. Strict allow-list (no add-new) — same shape as OCEANS.
// Ordering reflects rough cohort size: MBA-track programs first, then
// specialized masters, then PhD / undergrad.
export const PROGRAMS = [
  "MBA",
  "LGO",
  "SFMBA",
  "EMBA",
  "MFin",
  "MBAn",
  "MSMS",
  "PhD",
  "UGrad",
] as const;

// Seed list for the cities chip group. Members can add others, which then
// appear as chips alongside these for everyone in the cohort. Shared by both
// `cities` (where you live) and `visiting_cities` (where you frequently go).
export const CITIES = [
  "Atlanta, GA",
  "Austin, TX",
  "Bangalore, India",
  "Beijing, China",
  "Belgrade, Serbia",
  "Berlin, Germany",
  "Boston, MA",
  "Buenos Aires, Argentina",
  "Cambridge, MA",
  "Chicago, IL",
  "Dubai, UAE",
  "Hong Kong",
  "Houston, TX",
  "London, UK",
  "Los Angeles, CA",
  "Mexico City, Mexico",
  "Miami, FL",
  "Mumbai, India",
  "New York, NY",
  "Paris, France",
  "San Francisco, CA",
  "São Paulo, Brazil",
  "Seattle, WA",
  "Seoul, South Korea",
  "Shanghai, China",
  "Singapore",
  "Sydney, Australia",
  "Tel Aviv, Israel",
  "Tokyo, Japan",
  "Toronto, Canada",
  "Washington, DC",
] as const;

// Seed list for Sloan activities. Members can add others.
export const ACTIVITIES = [
  "100K",
  "AI Club",
  "Climate & Energy Prize",
  "Delta V",
  "Entrepreneurship",
  "ETA",
  "Follies",
  "Ops Club",
  "Research Assistant",
  "Rolling Sloans",
  "Teaching Assistant",
  "Tech Club",
  "TNT",
] as const;
