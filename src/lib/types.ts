export type Profile = {
  id: string;
  name: string | null;
  mit_email: string;
  personal_email: string | null;
  company: string | null;
  title: string | null;
  industries: string[];
  cities: string[];
  linkedin_url: string | null;
  profile_photo_url: string | null;
  ocean: string | null;
  activities: string[];
  created_at: string;
  updated_at: string;
};

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

// MIT Sloan Class of 2026 cohort names.
export const OCEANS = [
  "Atlantic",
  "Baltic",
  "Caribbean",
  "Indian",
  "Mediterranean",
  "Pacific",
] as const;

// Seed list for the cities chip group. Members can add others, which then
// appear as chips alongside these for everyone in the cohort.
export const CITIES = [
  "Atlanta, GA",
  "Austin, TX",
  "Bangalore, India",
  "Beijing, China",
  "Berlin, Germany",
  "Boston, MA",
  "Chicago, IL",
  "Dubai, UAE",
  "Hong Kong",
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
