"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { geocodeCity } from "@/lib/geocode";
import { ACTIVITIES, CITIES, INDUSTRIES, OCEANS, PROGRAMS, ROLES } from "@/lib/types";
import { CITY_ALIASES, canonKey } from "@/lib/cities";
import { safeEmail, safeLinkedInUrl } from "@/lib/url-safety";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type SeededColumn =
  | "industries"
  | "roles"
  | "cities"
  | "visiting_cities"
  | "activities";

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
 * write-in) against the cohort's existing canonical entries.
 *
 * Keys are `canonKey` — accent-, case-, and whitespace-insensitive — so e.g.
 * "Sao Paulo" and "São Paulo" collapse to one entry. For city columns a
 * curated `CITY_ALIASES` map also folds bare/variant names ("Cambridge" ->
 * "Cambridge, MA", "Sao Paulo" -> "São Paulo, Brazil") onto the canonical seed
 * form, which both dedups them and lets them geocode correctly. Dedup is by the
 * *resolved display's* key, so two variants that map to the same canonical
 * (e.g. "Sao Paulo" and "Sao Paulo, Brazil") collapse to a single entry.
 *
 * Seed entries are considered before cohort write-ins so the curated casing
 * (e.g. the accented "São Paulo, Brazil") wins over a cohort variant.
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
  const isCity = column === "cities" || column === "visiting_cities";

  // Canonical display per normalized key. Seed first so curated casing wins.
  const canonical = new Map<string, string>();
  for (const v of [...seed, ...cohort]) {
    const k = canonKey(v);
    if (!canonical.has(k)) canonical.set(k, v);
  }

  const result = new Map<string, string>();
  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const display =
      (isCity ? CITY_ALIASES[canonKey(trimmed)] : undefined) ??
      canonical.get(canonKey(trimmed)) ??
      trimmed;
    const displayKey = canonKey(display);
    if (!result.has(displayKey)) result.set(displayKey, display);
  };
  for (const c of chips) add(c);
  if (newValue) add(newValue);
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

    // Resize + recompress before storing. Phone uploads run multiple MB and
    // were previously served at full resolution into a 56px avatar — that
    // full-size, uncacheable delivery is what blew through the Supabase egress
    // quota. A 256px WebP avatar is ~20–40KB. .rotate() bakes in EXIF
    // orientation so portrait phone photos don't end up sideways once the
    // orientation tag is dropped by re-encoding.
    let resized: Buffer;
    try {
      const input = Buffer.from(await photoEntry.arrayBuffer());
      resized = await sharp(input)
        .rotate()
        .resize(256, 256, { fit: "cover", position: "centre" })
        .webp({ quality: 75 })
        .toBuffer();
    } catch {
      redirect(
        `/profile?error=${encodeURIComponent(
          "Couldn't process that image. Try a different file.",
        )}`,
      );
    }

    // Content-addressed path: the filename is a hash of the resized bytes, so
    // the storage path (and therefore the avatar URL) changes only when the
    // photo actually changes. That lets the /avatar route serve it as
    // immutable — the caching half of the egress fix. The old fixed
    // "<id>/avatar" path couldn't be cached because its URL never changed even
    // when the image did.
    const hash = createHash("sha256").update(resized).digest("hex").slice(0, 16);
    const path = `${user.id}/${hash}.webp`;
    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(path, resized, {
        upsert: true,
        contentType: "image/webp",
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
  const visitingCities = await resolveCanonical(
    supabase,
    "visiting_cities",
    CITIES,
    manyStrings(formData.getAll("visiting_cities")),
    trimOrNull(formData.get("visiting_cities_new")),
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
    personal_email: safeEmail(
      typeof formData.get("personal_email") === "string"
        ? (formData.get("personal_email") as string)
        : null,
    ),
    company: trimOrNull(formData.get("company")),
    title: trimOrNull(formData.get("title")),
    industries,
    roles,
    cities,
    visiting_cities: visitingCities,
    linkedin_url: safeLinkedInUrl(
      typeof formData.get("linkedin_url") === "string"
        ? (formData.get("linkedin_url") as string)
        : null,
    ),
    ocean: oneOfOrNull(formData.get("ocean"), OCEANS),
    program: oneOfOrNull(formData.get("program"), PROGRAMS),
    activities,
  };
  if (photoPath !== undefined) {
    payload.profile_photo_url = photoPath;
  }

  // Capture the previously-saved personal email so the sign-in transition is
  // auto-initiated only when it's newly added or changed — not on every save.
  const { data: prev } = await supabase
    .from("profiles")
    .select("personal_email, profile_photo_url")
    .eq("id", user.id)
    .maybeSingle<{
      personal_email: string | null;
      profile_photo_url: string | null;
    }>();

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  // Best-effort cleanup of the previous avatar object now that the row points
  // at the new content-addressed path. Without this, orphaned objects would
  // accumulate (one per upload) since the path is no longer a fixed
  // "<id>/avatar" that upsert overwrote in place.
  if (
    photoPath &&
    prev?.profile_photo_url &&
    prev.profile_photo_url !== photoPath
  ) {
    await supabase.storage
      .from("profile-photos")
      .remove([prev.profile_photo_url]);
  }

  revalidatePath("/profile");
  revalidatePath("/directory");
  revalidatePath("/stats");
  revalidatePath("/map");

  // Schedule background geocoding for any new (or stale-negative-cached)
  // cities, so the home map pins them on the next render without a code
  // edit. See src/lib/geocode.ts + the city_coords migration for the full
  // design. Runs in after() so the user's save UX is not blocked on
  // Nominatim (typically ~500ms+ per request, and we deliberately serialize
  // at 1 req/sec to respect their usage policy).
  const labelByKey = new Map<string, string>();
  for (const c of [...cities, ...visitingCities]) {
    const trimmed = c.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!labelByKey.has(key)) labelByKey.set(key, trimmed);
  }
  const cityKeys = Array.from(labelByKey.keys());
  if (cityKeys.length > 0) {
    const { data: existing } = await supabase
      .from("city_coords")
      .select("city_key, lat, geocoded_at")
      .in("city_key", cityKeys);

    const STALE_NEGATIVE_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const existingByKey = new Map(
      (existing ?? []).map((r) => [
        r.city_key as string,
        { lat: r.lat as number | null, geocoded_at: r.geocoded_at as string },
      ]),
    );
    const toGeocode = cityKeys.filter((key) => {
      const row = existingByKey.get(key);
      if (!row) return true;
      if (row.lat === null) {
        return now - new Date(row.geocoded_at).getTime() > STALE_NEGATIVE_MS;
      }
      return false;
    });

    if (toGeocode.length > 0) {
      after(async () => {
        for (let i = 0; i < toGeocode.length; i++) {
          if (i > 0) {
            await new Promise((r) => setTimeout(r, 1100));
          }
          const key = toGeocode[i];
          const result = await geocodeCity(key);
          if (result.ok) {
            await supabase.rpc("cache_city_coords", {
              p_key: key,
              p_label: labelByKey.get(key) ?? null,
              p_lat: result.lat,
              p_lng: result.lng,
            });
          } else if (result.reason === "miss") {
            await supabase.rpc("cache_city_coords", {
              p_key: key,
              p_label: labelByKey.get(key) ?? null,
              p_lat: null,
              p_lng: null,
            });
          }
          // transient: skip caching, next save retries naturally.
        }
      });
    }
  }

  // Auto-transition the sign-in identity: adding or changing the personal
  // email moves auth.users.email to it — there is no separate opt-in, this is
  // the only lockout defense (see CLAUDE.md). mit_email stays as the historical
  // directory identity. Supabase emails a confirmation to the new address;
  // until it's clicked the old email still signs them in. Requires Supabase
  // "Secure email change" OFF, else a second confirmation is also sent to the
  // Safe-Links-eaten MIT inbox and the change never lands.
  const newPersonal =
    typeof payload.personal_email === "string" ? payload.personal_email : null;
  const authEmail = (user.email ?? "").toLowerCase();
  const prevPersonal = prev?.personal_email?.toLowerCase() ?? null;
  if (
    newPersonal &&
    newPersonal.toLowerCase() !== authEmail &&
    newPersonal.toLowerCase() !== prevPersonal
  ) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { error: transitionError } = await supabase.auth.updateUser(
      { email: newPersonal },
      { emailRedirectTo: `${siteUrl}/auth/confirm?next=/profile` },
    );
    redirect(
      `/profile?saved=1&email_transition=${
        transitionError ? "error" : "pending"
      }`,
    );
  }

  redirect("/profile?saved=1");
}

/**
 * Recovery path for a stranded alumni transition: re-trigger the email-change
 * confirmation when the user never received or lost it. The auto-transition in
 * updateProfile only fires when personal_email actually changes, so without
 * this a lost confirmation has no way to be re-sent.
 *
 * Uses the SAME `updateUser({ email })` call as the auto-transition — not
 * `auth.resend`, which only re-sends an *already-pending* email_change and so
 * silently does nothing if no change is in progress (e.g. it expired, was
 * never initiated, or was already consumed). `updateUser` (re)initiates the
 * change and sends the confirmation every time, which is what "re-trigger"
 * needs. Restricted server-side to the user's already-saved personal_email so
 * it cannot retarget the change — the takeover surface is identical to the
 * automatic path. Supabase rate-limits the email (no app-side throttle,
 * consistent with the OTP posture).
 */
export async function resendEmailTransition() {
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
        "Add a personal email first — there's no sign-in change to confirm.",
      )}`,
    );
  }
  if (user.email?.toLowerCase() === target.toLowerCase()) {
    redirect(
      `/profile?error=${encodeURIComponent(
        "You're already signing in with your personal email — nothing to confirm.",
      )}`,
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.updateUser(
    { email: target },
    { emailRedirectTo: `${siteUrl}/auth/confirm?next=/profile` },
  );

  if (error) {
    redirect(
      `/profile?error=${encodeURIComponent(
        "Couldn't re-send the confirmation — it may be rate-limited (wait a minute), or that address is already in use on another account.",
      )}`,
    );
  }

  redirect("/profile?email_transition=resent");
}
