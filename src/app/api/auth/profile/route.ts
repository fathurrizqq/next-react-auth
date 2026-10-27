// POST /api/auth/profile
// Mengubah nama dan foto profil. Email dan password punya alur sendiri (dengan OTP).

import { randomUUID } from "crypto";
import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import {
  jsonResponse,
  requireSameOrigin,
  unauthorized,
} from "@/src/lib/security";
import { logActivity } from "@/src/lib/audit";
import { AVATAR_DIR, resolveAvatarPath } from "@/src/lib/avatar";
import { nameSchema } from "@/src/lib/validation";

// Ukuran foto maksimal 2 MB.
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
// Ukuran seluruh request maksimal 3 MB (foto + field lain).
const MAX_REQUEST_SIZE = 3 * 1024 * 1024;

// Tipe gambar yang diperbolehkan.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Hasil deteksi: tipe MIME dan ekstensi file yang aman dipakai.
type ImageType = {
  mime: string;
  extension: string;
};

/*
 * Deteksi tipe gambar dari magic bytes, bukan dari nama/MIME kiriman user.
 */
function detectImageType(buffer: Buffer): ImageType | null {
  // Tanda awal file JPEG: FF D8 FF.
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

  // Tanda awal file PNG: 8 byte signature.
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png" };
  }

  // WebP diawali "RIFF" lalu "WEBP" pada byte ke 8 sampai 11.
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }

  // Bukan JPEG / PNG / WebP.
  return null;
}

// Alur: cek origin -> login -> baca form -> validasi nama -> proses foto (jika ada)
// -> simpan ke database -> hapus foto lama -> catat log.
export async function POST(request: Request) {
  try {
    // Proteksi CSRF: tolak request yang tidak berasal dari website ini.
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    // Ambil sesi dari cookie. null = belum login atau sesi sudah habis.
    const session = await getSession();

    // Belum login -> 401.
    if (!session) {
      return unauthorized();
    }

    // Ambil data user dari database.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        avatar: true,
        isActive: true,
      },
    });

    // Akun tidak ditemukan atau sudah dinonaktifkan -> permintaan ditolak.
    if (!user || !user.isActive) {
      return unauthorized();
    }

    // Tolak lebih awal request yang jelas terlalu besar.
    const contentLength = request.headers.get("content-length");

    if (contentLength && Number(contentLength) > MAX_REQUEST_SIZE) {
      return jsonResponse({ message: "Ukuran request terlalu besar." }, 413);
    }

    // Baca form multipart (nama + foto). Gagal baca -> null.
    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return jsonResponse({ message: "Data profile tidak valid." }, 400);
    }

    // Ambil field dari form.
    const nameValue = formData.get("name");
    const avatarValue = formData.get("avatar");

    if (typeof nameValue !== "string") {
      return jsonResponse({ message: "Data profile tidak valid." }, 400);
    }

    // Validasi nama dengan aturan yang sama seperti registrasi.
    const result = z
      .object({ name: nameSchema })
      .safeParse({ name: nameValue });

    // Data tidak sesuai aturan -> 400 beserta pesan error per field.
    if (!result.success) {
      return jsonResponse(
        {
          message: "Data profile tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    // Default: foto lama dipertahankan.
    let avatarUrl = user.avatar;
    // Lokasi file foto baru di disk (untuk dibersihkan bila database gagal).
    let newAvatarPath: string | null = null;

    // Hanya proses foto jika user memilih file.
    if (avatarValue instanceof File && avatarValue.size > 0) {
      // Cek ukuran file.
      if (avatarValue.size > MAX_AVATAR_SIZE) {
        return jsonResponse({ message: "Ukuran foto maksimal 2 MB." }, 400);
      }

      // Cek tipe yang dilaporkan browser.
      if (!ALLOWED_MIME_TYPES.includes(avatarValue.type)) {
        return jsonResponse(
          { message: "Format foto harus JPG, PNG, atau WEBP." },
          400,
        );
      }

      // Baca isi file ke memori.
      const buffer = Buffer.from(await avatarValue.arrayBuffer());
      const detected = detectImageType(buffer);

      // Isi file harus benar-benar gambar dan cocok dengan tipe yang diklaim
      // (mencegah file berbahaya yang diberi ekstensi gambar).
      if (!detected || detected.mime !== avatarValue.type) {
        return jsonResponse({ message: "File gambar tidak valid." }, 400);
      }

      // Nama file acak: idUser-uuid.ekstensi (tidak bisa ditebak, tidak bentrok).
      const fileName = `${user.id}-${randomUUID()}.${detected.extension}`;

      // Buat folder uploads/avatars jika belum ada.
      await mkdir(AVATAR_DIR, { recursive: true });

      newAvatarPath = path.join(AVATAR_DIR, fileName);

      // Simpan file. Flag "wx" = gagal jika file sudah ada (tidak menimpa).
      await writeFile(newAvatarPath, buffer, { flag: "wx" });

      // URL yang disimpan di database dan dilayani oleh /api/avatars/[file].
      avatarUrl = `/api/avatars/${fileName}`;
    }

    // Simpan perubahan ke database.
    try {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: result.data.name,
          avatar: avatarUrl,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
        },
      });

      // Database sudah berhasil, baru hapus avatar lama.
      const oldPath = newAvatarPath ? resolveAvatarPath(user.avatar) : null;

      if (oldPath) {
        await unlink(oldPath).catch(() => undefined);
      }

      // Catat ke log aktivitas (tampil di halaman User Management).
      await logActivity({
        request,
        action: "PROFILE_UPDATED",
        actorId: user.id,
        actorEmail: user.email,
        detail: newAvatarPath ? "Nama dan foto profil" : "Nama",
      });

      return jsonResponse({
        message: "Profile berhasil diperbarui.",
        user: updatedUser,
      });
    } catch (error) {
      // DB gagal setelah file baru tersimpan: hapus file baru.
      if (newAvatarPath) {
        await unlink(newAvatarPath).catch(() => undefined);
      }

      // Lempar ke catch terluar -> 500.
      throw error;
    }
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("PROFILE_UPDATE_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat memperbarui profile." },
      500,
    );
  }
}