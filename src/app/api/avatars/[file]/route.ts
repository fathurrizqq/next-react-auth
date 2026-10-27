// GET /api/avatars/[file]
// Menampilkan foto profil dari folder uploads/avatars (di luar /public).

import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { AVATAR_DIR } from "@/src/lib/avatar";

// Hanya nama file berformat "uuid-uuid.ext" yang diterima, sehingga tidak bisa
// mengakses file lain atau keluar folder (path traversal).
const FILE_PATTERN =
  /^[0-9a-f-]{36}-[0-9a-f-]{36}\.(jpg|png|webp)$/;

// Jenis konten berdasarkan ekstensi file.
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// Next.js memberikan params sebagai Promise.
type RouteContext = {
  params: Promise<{ file: string }>;
};

// Kirim isi foto jika namanya valid dan filenya ada.
export async function GET(_request: Request, context: RouteContext) {
  // Nama file dari URL.
  const { file } = await context.params;

  // Cocokkan dengan pola yang diizinkan.
  const match = FILE_PATTERN.exec(file);

  // Nama file tidak valid -> 404.
  if (!match) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    // Baca file dari disk.
    const data = await readFile(path.join(AVATAR_DIR, file));

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[match[1]],
        // Browser tidak boleh menebak tipe file sendiri.
        "X-Content-Type-Options": "nosniff",
        // Nama file unik per upload, aman di-cache lama.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  // File tidak ditemukan -> 404.
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}