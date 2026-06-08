/**
 * Stable, cacheable URL for a member's avatar, served by the `/avatar/[id]`
 * route handler. The `v` segment is derived from the content-addressed storage
 * path (the filename is a hash of the image bytes — see `updateProfile`), so
 * the URL changes only when the photo changes. That lets the route serve the
 * image as `immutable`: repeat directory / page loads are answered from the
 * browser cache instead of re-egressing from Supabase Storage.
 *
 * Returns null when there is no photo, so callers render the initial instead.
 */
export function avatarSrc(
  userId: string,
  photoPath: string | null | undefined,
): string | null {
  if (!photoPath) return null;
  // Filename without extension = the content hash set at upload time. For any
  // legacy object stored at the old fixed "<id>/avatar" path this is just
  // "avatar", which still produces a stable (if coarse) cache key.
  const file = photoPath.split("/").pop() ?? photoPath;
  const version = file.replace(/\.[^.]+$/, "");
  return `/avatar/${encodeURIComponent(userId)}?v=${encodeURIComponent(version)}`;
}
