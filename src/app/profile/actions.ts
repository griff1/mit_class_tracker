"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITIES, CITIES, INDUSTRIES, OCEANS, ROLES } from "@/lib/types";

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

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

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

  const payload = {
    name: trimOrNull(formData.get("name")),
    personal_email: trimOrNull(formData.get("personal_email")),
    company: trimOrNull(formData.get("company")),
    title: trimOrNull(formData.get("title")),
    industries,
    roles,
    cities,
    linkedin_url: trimOrNull(formData.get("linkedin_url")),
    ocean: oneOfOrNull(formData.get("ocean"), OCEANS),
    activities,
  };

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
