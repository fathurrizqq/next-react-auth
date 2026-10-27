// avatar.ts
// Lokasi penyimpanan foto profil di disk.

import path from "path";

/*
 * Avatar disimpan di luar /public agar file yang di-upload saat runtime
 * tetap bisa disajikan di produksi (lewat /api/avatars/[file]).
 */
export const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");

// Ubah URL avatar yang tersimpan di database menjadi lokasi file di disk
// (dipakai untuk menghapus foto lama). Mengembalikan null bila bukan avatar lokal.
export function resolveAvatarPath(url: string | null): string | null {
  if (!url) {
    return null;
  }

  // Format baru: file ada di folder uploads/avatars.
  if (url.startsWith("/api/avatars/")) {
    // path.basename membuang bagian folder, sehingga tidak bisa keluar dari folder avatar.
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