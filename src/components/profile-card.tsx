import { Avatar } from "@/components/avatar";
import { ClickablePhotoAvatar } from "@/components/clickable-photo-avatar";
import { OCEAN_COLOR } from "@/lib/oceans";
import { safeLinkedInUrl } from "@/lib/url-safety";

export type DirectoryRow = {
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
  ocean: string | null;
  profile_photo_url: string | null;
  activities: string[];
};

export function ProfileCard({
  profile,
  photoUrl,
}: {
  profile: DirectoryRow;
  photoUrl?: string | null;
}) {
  const displayName = profile.name?.trim() || profile.mit_email;
  const work = [profile.title, profile.company].filter(Boolean).join(" at ");
  // Defense in depth: re-validate scheme + linkedin.com hostname at render.
  const linkedinHref = safeLinkedInUrl(profile.linkedin_url);
  return (
    <li className="grid grid-cols-[44px_1fr] gap-4 rounded-md border border-line bg-paper p-4">
      {photoUrl ? (
        <ClickablePhotoAvatar
          name={displayName}
          photoUrl={photoUrl}
          ocean={profile.ocean}
        />
      ) : (
        <Avatar name={displayName} size="md" ocean={profile.ocean} />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em]">
            <span
              className={
                (profile.ocean && OCEAN_COLOR[profile.ocean]?.text) ||
                "text-ink-3"
              }
            >
              {profile.ocean ?? "—"}
            </span>
            <span className="text-ink-3"> · &apos;26</span>
          </span>
          {linkedinHref && (
            <a
              href={linkedinHref}
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
        <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
          <a
            href={`mailto:${profile.mit_email}`}
            className="font-mono text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline"
          >
            {profile.mit_email}
          </a>
          {profile.personal_email && (
            <a
              href={`mailto:${profile.personal_email}`}
              className="font-mono text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline"
            >
              {profile.personal_email}
            </a>
          )}
        </p>
        {profile.cities.length > 0 && (
          <p className="text-xs text-ink-2 before:mr-1 before:font-mono before:text-ink-3 before:content-['—']">
            {profile.cities.join(" · ")}
          </p>
        )}
        {profile.visiting_cities.length > 0 && (
          <p className="text-xs text-ink-2">
            <span className="mr-1.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-3">
              Often in
            </span>
            {profile.visiting_cities.join(" · ")}
          </p>
        )}
        {profile.roles.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {profile.roles.map((r) => (
              <li
                key={r}
                className="rounded-sm border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] lowercase text-brand-700"
              >
                {r}
              </li>
            ))}
          </ul>
        )}
        {profile.industries.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {profile.industries.map((ind) => (
              <li
                key={ind}
                className="rounded-sm border border-line px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] lowercase text-ink-2"
              >
                {ind}
              </li>
            ))}
          </ul>
        )}
        {profile.activities.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {profile.activities.map((act) => (
              <li
                key={act}
                className="rounded-sm border border-dashed border-line-2 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] lowercase text-ink-3"
              >
                {act}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
