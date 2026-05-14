"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INDUSTRIES, OCEANS } from "@/lib/types";

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

function manyOfFromAllowed<T extends string>(
  values: FormDataEntryValue[],
  allowed: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if ((allowed as readonly string[]).includes(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed as T);
    }
  }
  return out;
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const payload = {
    name: trimOrNull(formData.get("name")),
    personal_email: trimOrNull(formData.get("personal_email")),
    company: trimOrNull(formData.get("company")),
    title: trimOrNull(formData.get("title")),
    industries: manyOfFromAllowed(formData.getAll("industries"), INDUSTRIES),
    city: trimOrNull(formData.get("city")),
    linkedin_url: trimOrNull(formData.get("linkedin_url")),
    ocean: oneOfOrNull(formData.get("ocean"), OCEANS),
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
  redirect("/profile?saved=1");
}
