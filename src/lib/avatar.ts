import path from "path";

/*
 * Avatar disimpan di luar /public agar file yang di-upload saat runtime
 * tetap bisa disajikan di produksi (lewat /api/avatars/[file]).
 */
export const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");

export function resolveAvatarPath(url: string | null): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("/api/avatars/")) {
    return path.join(AVATAR_DIR, path.basename(url));
  }

  // Kompatibel dengan avatar lama.
  if (url.startsWith("/uploads/avatars/")) {
    return path.join(
      process.cwd(),
      "public",
      "uploads",
      "avatars",
      path.basename(url),
    );
  }

  return null;
}