import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import { avatarSrc } from "@/lib/avatar";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type Viewer = {
  name: string | null;
  email: string;
  personalEmail: string | null;
  ocean: string | null;
  photoUrl: string | null;
};

/**
 * Loads the profile fields the AppShell top nav needs (name, optional photo)
 * plus `ocean` for page-header eyebrows. One profile-row query; the avatar is
 * the stable /avatar proxy URL (no Storage call).
 *
 * Returns a Viewer with nulls if the profile row doesn't exist yet — useful
 * for error shells and the moments before the on_auth_user_confirmed trigger
 * has fired.
 */
export async function getViewer(
  supabase: ServerClient,
  user: User,
): Promise<Viewer> {
  const { data } = await supabase
    .from("profiles")
    .select("name, personal_email, ocean, profile_photo_url")
    .eq("id", user.id)
    .maybeSingle<{
      name: string | null;
      personal_email: string | null;
      ocean: string | null;
      profile_photo_url: string | null;
    }>();

  return {
    name: data?.name ?? null,
    email: user.email!,
    personalEmail: data?.personal_email ?? null,
    ocean: data?.ocean ?? null,
    photoUrl: avatarSrc(user.id, data?.profile_photo_url),
  };
}
