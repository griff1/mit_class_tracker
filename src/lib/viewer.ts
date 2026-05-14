import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type Viewer = {
  name: string | null;
  email: string;
  ocean: string | null;
  photoUrl: string | null;
};

/**
 * Loads the profile fields the AppShell top nav needs (name, optional photo)
 * plus `ocean` for page-header eyebrows. One profile-row query + one optional
 * Storage signed-URL call.
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
    .select("name, ocean, profile_photo_url")
    .eq("id", user.id)
    .maybeSingle<{
      name: string | null;
      ocean: string | null;
      profile_photo_url: string | null;
    }>();

  let photoUrl: string | null = null;
  if (data?.profile_photo_url) {
    const { data: signed } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(data.profile_photo_url, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }

  return {
    name: data?.name ?? null,
    email: user.email!,
    ocean: data?.ocean ?? null,
    photoUrl,
  };
}
