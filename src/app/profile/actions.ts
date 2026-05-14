"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITIES, CITIES, INDUSTRIES, OCEANS, ROLES } from "@/lib/types";
import { safeLinkedInUrl } from "@/lib/url-safety";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type SeededColumn = "industries" | "roles" | "cities" | "activities";

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

function oneOfOrNull<T extends string>(
  v: FormDataEntryValue | null,
  allowed: readonly T[],
): T | null {
  const s = trimOrNull(v);
  if (s === null) return null;
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

function manyStrings(values: FormDataEntryValue[]): string[] {
  return values.filter((v): v is string => typeof v === "string");
}

/**
 * Resolves a user-submitted set of values (chip selections + optional new
 * write-in) against the cohort's existing canonical entries. Case-insensitive:
 * if the new write-in matches an existing entry by lowercase, we keep the
 * existing casing instead of introducing a duplicate.
 *
 * Returns a deduped array in the order: chips first, then the new value if it
 * survived as a fresh entry.
 */
async function resolveCanonical(
  supabase: ServerClient,
  column: SeededColumn,
  seed: readonly string[],
  chips: string[],
  newValue: string | null,
): Promise<string[]> {
  const { data } = await supabase.from("profiles").select(column);
  const cohort = ((data ?? []) as Array<Record<string, unknown>>).flatMap(
    (r) => (r[column] as string[] | null) ?? [],
  );

  // Build canonical map (lowercase key → display value). First-seen wins.
  const canonical = new Map<string, string>();
  for (const v of [...cohort, ...seed]) {
    const k = v.toLowerCase();
    if (!canonical.has(k)) canonical.set(k, v);
  }

  const result = new Map<string, string>();
  for (const c of chips) {
    const trimmed = c.trim();
    if (!trimmed) continue;
    const k = trimmed.toLowerCase();
    const display = canonical.get(k) ?? trimmed;
    if (!result.has(k)) result.set(k, display);
  }
  if (newValue) {
    const k = newValue.toLowerCase();
    const display = canonical.get(k) ?? newValue;
    if (!result.has(k)) result.set(k, display);
  }
  return Array.from(result.values());
}

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Optional photo upload. The file input only ships bytes when the user
  // actually selected something; an empty File (size 0) means they didn't.
  let photoPath: string | undefined;
  const photoEntry = formData.get("profile_photo");
  if (photoEntry instanceof File && photoEntry.size > 0) {
    if (photoEntry.size > PHOTO_MAX_BYTES) {
      redirect(
        `/profile?error=${encodeURIComponent(
          "Photo must be 5 MB or smaller.",
        )}`,
      );
    }
    if (!PHOTO_ALLOWED_TYPES.has(photoEntry.type)) {
      redirect(
        `/profile?error=${encodeURIComponent(
          "Photo must be JPEG, PNG, WebP, or GIF.",
        )}`,
      );
    }

    // Single path per user — upsert overwrites the previous photo. Content
    // type is preserved as metadata so the right MIME is served regardless
    // of the URL extension (we don't store one).
    const path = `${user.id}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(path, photoEntry, {
        upsert: true,
        contentType: photoEntry.type,
      });
    if (uploadError) {
      redirect(
        `/profile?error=${encodeURIComponent(
          `Photo upload failed: ${uploadError.message}`,
        )}`,
      );
    }
    photoPath = path;
  }

  const industries = await resolveCanonical(
    supabase,
    "industries",
    INDUSTRIES,
    manyStrings(formData.getAll("industries")),
    trimOrNull(formData.get("industries_new")),
  );
  const roles = await resolveCanonical(
    supabase,
    "roles",
    ROLES,
    manyStrings(formData.getAll("roles")),
    trimOrNull(formData.get("roles_new")),
  );
  const cities = await resolveCanonical(
    supabase,
    "cities",
    CITIES,
    manyStrings(formData.getAll("cities")),
    trimOrNull(formData.get("cities_new")),
  );
  const activities = await resolveCanonical(
    supabase,
    "activities",
    ACTIVITIES,
    manyStrings(formData.getAll("activities")),
    trimOrNull(formData.get("activities_new")),
  );

  const payload: Record<string, unknown> = {
    name: trimOrNull(formData.get("name")),
    personal_email: trimOrNull(formData.get("personal_email")),
    company: trimOrNull(formData.get("company")),
    title: trimOrNull(formData.get("title")),
    industries,
    roles,
    cities,
    linkedin_url: safeLinkedInUrl(
      typeof formData.get("linkedin_url") === "string"
        ? (formData.get("linkedin_url") as string)
        : null,
    ),
    ocean: oneOfOrNull(formData.get("ocean"), OCEANS),
    activities,
  };
  if (photoPath !== undefined) {
    payload.profile_photo_url = photoPath;
  }

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/directory");
  revalidatePath("/stats");
  revalidatePath("/map");
  redirect("/profile?saved=1");
}

/**
 * Transition the user's sign-in email from their MIT address to their saved
 * personal_email. Used when an alum is about to lose @mit.edu access.
 *
 * Constraints (enforced server-side):
 *   - User must be signed in
 *   - profile.personal_email must be set (we won't transition to an empty value)
 *   - Current auth email must NOT already equal personal_email
 *
 * Supabase sends a confirmation link to the *new* email; once the user clicks
 * it, `auth.users.email` updates and they sign in with that address going
 * forward. The `before_user_created` Auth Hook does NOT fire on email change
 * — only on initial signup — so the @mit.edu domain check is intentionally
 * not applied here (alumni moving to gmail / outlook / etc. is the point).
 *
 * `profile.mit_email` is left untouched as the historical identity.
 */
export async function transitionAuthEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("personal_email")
    .eq("id", user.id)
    .maybeSingle<{ personal_email: string | null }>();

  const target = profile?.personal_email?.trim();
  if (!target) {
    redirect(
      `/profile?error=${encodeURIComponent(
        "Set a personal email first, then come back to transition.",
      )}`,
    );
  }
  if (user.email?.toLowerCase() === target.toLowerCase()) {
    redirect(
      `/profile?error=${encodeURIComponent(
        "You're already signing in with your personal email.",
      )}`,
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.updateUser(
    { email: target },
    { emailRedirectTo: `${siteUrl}/auth/confirm?next=/profile` },
  );
  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/profile?email_transition=pending");
}
