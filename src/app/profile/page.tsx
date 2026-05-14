import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITIES, CITIES, INDUSTRIES, OCEANS, type Profile } from "@/lib/types";
import { updateProfile } from "./actions";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Section } from "@/components/section";
import { FieldRow, ReadOnlyValue } from "@/components/field-row";
import { Input, Select } from "@/components/inputs";
import { Chip } from "@/components/chip";
import { EditableChipGroup } from "@/components/editable-chip-group";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;

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

  // Pull cohort-known cities and activities to surface alongside the seed
  // lists in the editable chip groups.
  const { data: cohort } = await supabase.from("profiles").select("cities, activities");
  const knownCities = Array.from(
    new Set((cohort ?? []).flatMap((r) => (r.cities as string[] | null) ?? [])),
  );
  const knownActivities = Array.from(
    new Set((cohort ?? []).flatMap((r) => (r.activities as string[] | null) ?? [])),
  );

  return (
    <AppShell active="profile" user={{ name: profile.name, email: user.email! }}>
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

      <form action={updateProfile} className="flex flex-col gap-3">
        <Section label="Identity" index={1}>
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
        </Section>

        <Section label="Work" index={2}>
          <FieldRow label="Company">
            <Input name="company" defaultValue={profile.company ?? ""} placeholder="Acme Corp" />
          </FieldRow>
          <FieldRow label="Title">
            <Input name="title" defaultValue={profile.title ?? ""} placeholder="Product Manager" />
          </FieldRow>
          <FieldRow label="Industries" help="Pick all that apply.">
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRIES.map((ind) => (
                <Chip
                  key={ind}
                  name="industries"
                  value={ind}
                  defaultChecked={profile.industries.includes(ind)}
                />
              ))}
            </div>
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
          <FieldRow label="LinkedIn">
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
    <AppShell active="profile" user={{ name: null, email }}>
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
