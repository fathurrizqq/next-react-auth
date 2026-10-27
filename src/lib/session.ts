// session.ts
// Sistem login berbasis sesi di database.
// Cookie hanya berisi token acak; database hanya menyimpan hash-nya.

import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "crypto";

import { prisma } from "@/src/lib/prisma";
import type { UserRole } from "@/src/lib/roles";

/*
 * Session disimpan di database. Cookie hanya berisi token acak;
 * database hanya menyimpan hash-nya. Masa berlaku absolut 3 jam.
 */
// true di production (HTTPS): cookie hanya dikirim lewat HTTPS.
const SECURE = process.env.NODE_ENV === "production";
// Prefix __Host- membuat cookie hanya berlaku untuk domain ini dan wajib Secure.
const COOKIE_NAME = SECURE ? "__Host-sid" : "sid";

// Masa berlaku sesi: 3 jam sejak login.
export const SESSION_DURATION_MS = 3 * 60 * 60 * 1000;

// Data sesi yang dikembalikan oleh getSession().
export type Session = {
  sessionId: string;
  userId: string;
  role: UserRole;
};

// Hash SHA-256 untuk token. Yang disimpan di database hanya hash-nya,
// jadi jika database bocor, token asli tidak ikut bocor.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Buat sesi baru untuk user yang berhasil login, lalu pasang tokennya di cookie.
export async function createSession(userId: string): Promise<void> {
  // Token acak 256-bit (tidak bisa ditebak).
  const token = randomBytes(32).toString("base64url");
  // Waktu sesi berakhir.
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  // Info browser (dipotong 255 karakter) untuk catatan sesi.
  const userAgent =
    (await headers()).get("user-agent")?.slice(0, 255) ?? null;

  // Sekaligus: hapus sesi yang sudah kedaluwarsa, lalu simpan sesi baru (hash token).
  await prisma.$transaction([
    // Bersihkan session kedaluwarsa sambil jalan.
    prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }),
    prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        userAgent,
        expiresAt,
      },
    }),
  ]);

  // Tulis cookie ke browser:
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    // JavaScript di browser tidak bisa membaca cookie ini (aman dari XSS).
    httpOnly: true,
    // Hanya dikirim lewat HTTPS di production.
    secure: SECURE,
    // Cookie tidak ikut dikirim dari website lain (membantu cegah CSRF).
    sameSite: "lax",
    // Berlaku untuk seluruh halaman.
    path: "/",
    // Cookie hilang saat sesi habis.
    expires: expiresAt,
  });
}

// Cari sesi yang sedang aktif. cache() dari React membuat query ini
// hanya dijalankan sekali per request.
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  // Ambil token dari cookie.
  const token = store.get(COOKIE_NAME)?.value;

  // Tidak ada cookie -> belum login.
  if (!token) {
    return null;
  }

  // Cari sesi lewat hash token, sekaligus data user pemiliknya.
  const record = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  // Sesi tidak ada, sudah kedaluwarsa, atau akun dinonaktifkan -> dianggap belum login.
  if (
    !record ||
    record.expiresAt <= new Date() ||
    !record.user.isActive
  ) {
    return null;
  }

  // Role dibaca langsung dari database, jadi perubahan role / penonaktifan langsung berlaku.
  return {
    sessionId: record.id,
    userId: record.user.id,
    role: record.user.role,
  };
});

// Hapus sesi dari database dan cookie (dipakai saat logout).
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  // Hapus baris sesi di database bila tokennya ada.
  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  // Hapus cookie dari browser.
  store.delete(COOKIE_NAME);
}