import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITIES, CITIES, INDUSTRIES, OCEANS, ROLES, type Profile } from "@/lib/types";
import { updateProfile } from "./actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { FieldRow, ReadOnlyValue } from "@/components/field-row";
import { Input, Select } from "@/components/inputs";
import { EditableChipGroup } from "@/components/editable-chip-group";
import { Avatar } from "@/components/avatar";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    email_transition?: string;
  }>;
}) {
  const { saved, error, email_transition } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (fetchError) {
    return (
      <ErrorShell email={user.email!} title="Couldn't load your profile" message={fetchError.message} />
    );
  }
  if (!profile) {
    return (
      <ErrorShell
        email={user.email!}
        title="Profile not found"
        message="Your auth account exists but no profile row was created. Check that the schema migration ran."
      />
    );
  }

  // Pull cohort-known values to surface alongside the seed lists in the
  // editable chip groups.
  const { data: cohort } = await supabase
    .from("profiles")
    .select("industries, roles, cities, visiting_cities, activities");
  const knownIndustries = Array.from(
    new Set((cohort ?? []).flatMap((r) => (r.industries as string[] | null) ?? [])),
  );
  const knownRoles = Array.from(
    new Set((cohort ?? []).flatMap((r) => (r.roles as string[] | null) ?? [])),
  );
  const knownCities = Array.from(
    new Set((cohort ?? []).flatMap((r) => (r.cities as string[] | null) ?? [])),
  );
  const knownVisitingCities = Array.from(
    new Set(
      (cohort ?? []).flatMap(
        (r) => (r.visiting_cities as string[] | null) ?? [],
      ),
    ),
  );
  const knownActivities = Array.from(
    new Set((cohort ?? []).flatMap((r) => (r.activities as string[] | null) ?? [])),
  );

  // Signed URL for the current photo so the form can render a preview.
  // Paths are stored in profile_photo_url; signed URLs are generated per
  // render with a 1-hour expiry.
  let photoUrl: string | null = null;
  if (profile.profile_photo_url) {
    const { data: signed } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(profile.profile_photo_url, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }

  const displayName = profile.name?.trim() || profile.mit_email;

  return (
    <AppShell
      active="profile"
      user={{
        name: profile.name,
        email: user.email!,
        personalEmail: profile.personal_email,
        ocean: profile.ocean,
        photoUrl,
      }}
    >
      <PageHeader
        eyebrow="Your profile"
        title={profile.name?.trim() || "Tell your class about yourself"}
        sub="Visible to other signed-in @mit.edu classmates."
      />

      {saved && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          Profile saved.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {email_transition === "pending" && (
        <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-800">
          Confirmation link sent to your personal email. Open it from that
          inbox to move your sign-in over. Until you click it, you keep
          signing in with your current email.
        </p>
      )}
      {email_transition === "error" && (
        <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          Profile saved, but we couldn&apos;t start moving your sign-in to that
          personal email (it may already be in use on another account). Try a
          different address.
        </p>
      )}

      <form action={updateProfile} className="flex flex-col gap-3">
        <Section label="Identity" index={1}>
          <FieldRow
            label="Photo"
            help="Optional. JPEG / PNG / WebP / GIF, up to 5 MB. Visible to classmates."
          >
            <div className="flex items-center gap-4">
              <Avatar
                name={displayName}
                size="lg"
                photoUrl={photoUrl}
                ocean={profile.ocean}
              />
              <input
                type="file"
                name="profile_photo"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="text-sm text-ink-2 file:mr-3 file:rounded-md file:border file:border-line file:bg-cream file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-paper"
              />
            </div>
          </FieldRow>
          <FieldRow label="MIT email">
            <ReadOnlyValue>{profile.mit_email}</ReadOnlyValue>
          </FieldRow>
          <FieldRow label="Display name">
            <Input name="name" defaultValue={profile.name ?? ""} placeholder="Jane Doe" />
          </FieldRow>
          <FieldRow label="Personal email" help="Where to reach you after your MIT email expires.">
            <Input
              name="personal_email"
              type="email"
              defaultValue={profile.personal_email ?? ""}
              placeholder="jane@gmail.com"
            />
          </FieldRow>
          <FieldRow
            label="Sign-in email"
            help={signInEmailHelp(user.email!, profile.personal_email)}
          >
            <span className="font-mono text-sm text-ink">{user.email}</span>
          </FieldRow>
        </Section>

        <Section label="Work" index={2}>
          <FieldRow label="Company">
            <Input name="company" defaultValue={profile.company ?? ""} placeholder="Acme Corp" />
          </FieldRow>
          <FieldRow label="Title">
            <Input name="title" defaultValue={profile.title ?? ""} placeholder="Product Manager" />
          </FieldRow>
          <FieldRow label="Roles" help="What you actually do day-to-day. Pick all that apply.">
            <EditableChipGroup
              name="roles"
              newName="roles_new"
              options={[...ROLES, ...knownRoles]}
              selected={profile.roles}
              newPlaceholder="Add a role not listed"
            />
          </FieldRow>
          <FieldRow label="Industries" help="Pick all that apply, or add a new one.">
            <EditableChipGroup
              name="industries"
              newName="industries_new"
              options={[...INDUSTRIES, ...knownIndustries]}
              selected={profile.industries}
              newPlaceholder="Add an industry not listed"
            />
          </FieldRow>
        </Section>

        <Section label="Place" index={3}>
          <FieldRow label="Cities" help="Pick where you're based — multiple is fine. Add a new one if yours isn't listed.">
            <EditableChipGroup
              name="cities"
              newName="cities_new"
              options={[...CITIES, ...knownCities]}
              selected={profile.cities}
              newPlaceholder="Add a city not listed (e.g. Portland, OR)"
            />
          </FieldRow>
          <FieldRow label="Frequently in" help="Cities you travel to often for work or otherwise. Shown on the map under a separate toggle.">
            <EditableChipGroup
              name="visiting_cities"
              newName="visiting_cities_new"
              options={[...CITIES, ...knownVisitingCities]}
              selected={profile.visiting_cities}
              newPlaceholder="Add a city not listed (e.g. Portland, OR)"
            />
          </FieldRow>
          <FieldRow label="Ocean">
            <Select name="ocean" defaultValue={profile.ocean ?? ""}>
              <option value="">— Select —</option>
              {OCEANS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="LinkedIn" help="Must be a linkedin.com URL. Other URLs are dropped on save.">
            <Input
              name="linkedin_url"
              type="url"
              defaultValue={profile.linkedin_url ?? ""}
              placeholder="https://www.linkedin.com/in/..."
            />
          </FieldRow>
        </Section>

        <Section label="Sloan" index={4}>
          <FieldRow label="Activities" help="Clubs, competitions, fellowships — pick all that apply, or add one we don't have.">
            <EditableChipGroup
              name="activities"
              newName="activities_new"
              options={[...ACTIVITIES, ...knownActivities]}
              selected={profile.activities}
              newPlaceholder="Add an activity not listed"
            />
          </FieldRow>
        </Section>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-md bg-ink px-5 py-2 text-sm font-medium text-cream transition hover:bg-ink-2"
          >
            Save profile
          </button>
        </div>
      </form>
    </AppShell>
  );
}

function signInEmailHelp(
  currentEmail: string,
  personalEmail: string | null,
): string {
  if (!personalEmail) {
    return "Where your 6-digit sign-in code is sent. Add a personal email above and sign-in moves to it automatically — do this before your MIT email expires.";
  }
  if (currentEmail.toLowerCase() === personalEmail.toLowerCase()) {
    return "Moved over — sign-in codes now go to your personal email. Your MIT email stays as your directory identity.";
  }
  return "Codes still come here. Saving your personal email started the move; open the confirmation link we emailed to that address to finish it.";
}

function ErrorShell({
  email,
  title,
  message,
}: {
  email: string;
  title: string;
  message: string;
}) {
  return (
    <AppShell
      active="profile"
      user={{ name: null, email, personalEmail: null, ocean: null, photoUrl: null }}
    >
      <PageHeader eyebrow="Your profile" title={title} />
      <p className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
        {message}
      </p>
      <Link href="/" className="text-sm text-ink-2 underline-offset-4 hover:text-brand-700 hover:underline">
        ← Home
      </Link>
    </AppShell>
  );
}
