import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth-gated avatar proxy. Streams a member's profile photo out of the private
 * `profile-photos` bucket with an immutable cache header, so repeat views are
 * served from the browser cache rather than re-downloading from Supabase
 * Storage on every render. This is the caching half of the egress fix; the
 * other half is resizing on upload (see `updateProfile`).
 *
 * Why this exists instead of signed URLs: `createSignedUrl` minted a fresh
 * token on every render, so the image URL changed every load and defeated both
 * the browser cache and Supabase's CDN — every directory view re-egressed every
 * photo. Here the URL is stable (keyed by a content hash via `avatarSrc`) and
 * cacheable. We always serve the member's *current* photo; `?v=` is purely the
 * cache key, so a changed photo emits a new URL and bypasses the old cache
 * entry.
 *
 * Cache-Control is `private`: every authenticated cohort member may see every
 * avatar, but keeping shared/CDN caches out of it guarantees an image is never
 * served to an unauthenticated request. Post-resize each avatar is ~20–40KB, so
 * the per-user first-fetch cost is negligible.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // RLS allows any authenticated member to read any profile row (the directory
  // is intra-class-visible), so this resolves the target's current photo path.
  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_photo_url")
    .eq("id", id)
    .maybeSingle<{ profile_photo_url: string | null }>();

  const path = profile?.profile_photo_url;
  if (!path) {
    return new Response("Not found", { status: 404 });
  }

  const { data: blob, error } = await supabase.storage
    .from("profile-photos")
    .download(path);
  if (error || !blob) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": blob.type || "image/webp",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
