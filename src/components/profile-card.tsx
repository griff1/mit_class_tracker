import { Avatar } from "@/components/avatar";

export type DirectoryRow = {
  id: string;
  name: string | null;
  mit_email: string;
  company: string | null;
  title: string | null;
  industries: string[];
  roles: string[];
  cities: string[];
  linkedin_url: string | null;
  ocean: string | null;
};

export function ProfileCard({ profile }: { profile: DirectoryRow }) {
  const displayName = profile.name?.trim() || profile.mit_email;
  const work = [profile.title, profile.company].filter(Boolean).join(" at ");
  return (
    <li className="grid grid-cols-[44px_1fr] gap-4 rounded-md border border-line bg-paper p-4">
      <Avatar name={displayName} size="md" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">
            {profile.ocean ?? "—"} · &apos;26
          </span>
          {profile.linkedin_url && (
            <a
              href={profile.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-xs text-brand-700 underline-offset-4 hover:underline"
            >
              LinkedIn ↗
            </a>
          )}
        </div>
        <h2 className="truncate text-base font-semibold tracking-tight text-ink">
          {displayName}
        </h2>
        {work && <p className="text-sm text-ink-2">{work}</p>}
        {profile.cities.length > 0 && (
          <p className="text-xs text-ink-2 before:mr-1 before:font-mono before:text-ink-3 before:content-['—']">
            {profile.cities.join(" · ")}
          </p>
        )}
        {(profile.roles.length > 0 || profile.industries.length > 0) && (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {profile.roles.map((r) => (
              <li
                key={`r-${r}`}
                className="rounded-sm border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] lowercase text-brand-700"
              >
                {r}
              </li>
            ))}
            {profile.industries.map((ind) => (
              <li
                key={`i-${ind}`}
                className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] lowercase text-ink-2"
              >
                {ind}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
