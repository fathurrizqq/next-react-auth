// security.ts
// Fungsi keamanan & respons standar yang dipakai semua endpoint API.

import { NextResponse } from "next/server";

// Header agar browser/proxy tidak menyimpan cache respons (penting untuk data login).
export function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
  };
}

// Pembungkus NextResponse.json yang otomatis menambahkan header no-store.
export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: noStoreHeaders(),
  });
}

// Respons standar 401: belum login.
export const unauthorized = () =>
  jsonResponse({ message: "Anda harus login terlebih dahulu." }, 401);

// Respons standar 429: terlalu banyak percobaan.
export const tooManyRequests = (
  message = "Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.",
) => jsonResponse({ message }, 429);

// Baca body JSON. Jika body bukan JSON valid, kembalikan null (bukan error).
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/*
 * Origin yang diharapkan diambil dari APP_URL supaya tetap benar
 * di belakang reverse proxy (request.url bisa berupa alamat internal).
 */
function getExpectedOrigin(request: Request): string {
  // Alamat resmi aplikasi dari .env.
  const appUrl = process.env.APP_URL;

  if (appUrl) {
    try {
      return new URL(appUrl).origin;
    } catch {
      // APP_URL tidak valid, pakai origin request.
    }
  }

  return new URL(request.url).origin;
}

// Pastikan request benar-benar datang dari website kita sendiri (proteksi CSRF).
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  // Browser mengirim header Origin pada POST/PATCH/DELETE -> harus sama dengan origin kita.
  if (origin) {
    return origin === getExpectedOrigin(request);
  }

  // Tanpa Origin, hanya terima request yang jelas berasal dari
  // halaman kita sendiri.
  // Header yang diisi otomatis oleh browser modern.
  const site = request.headers.get("sec-fetch-site");

  return site === "same-origin" || site === "none";
}

// Dipanggil di awal tiap endpoint: mengembalikan respons 403 jika origin salah,
// atau null jika aman.
export function requireSameOrigin(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonResponse({ message: "Permintaan tidak diizinkan." }, 403);
  }

  return null;
}

/*
 * Opsional: batasi registrasi ke domain email kantor.
 * Aktif hanya jika ALLOWED_EMAIL_DOMAIN diisi.
 */
export function isAllowedEmailDomain(email: string): boolean {
  const domain = process.env.ALLOWED_EMAIL_DOMAIN?.trim()
    .toLowerCase()
    .replace(/^@/, "");

  // Pembatasan tidak aktif (env kosong) -> semua domain email boleh.
  if (!domain) {
    return true;
  }

  // Email harus berakhiran @domain yang ditentukan.
  return email.endsWith(`@${domain}`);
}