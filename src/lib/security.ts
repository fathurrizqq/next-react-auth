import { NextResponse } from "next/server";

export function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
  };
}

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: noStoreHeaders(),
  });
}

export const unauthorized = () =>
  jsonResponse({ message: "Anda harus login terlebih dahulu." }, 401);

export const tooManyRequests = (
  message = "Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.",
) => jsonResponse({ message }, 429);

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

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin === getExpectedOrigin(request);
  }

  // Tanpa Origin, hanya terima request yang jelas berasal dari
  // halaman kita sendiri.
  const site = request.headers.get("sec-fetch-site");

  return site === "same-origin" || site === "none";
}

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

  if (!domain) {
    return true;
  }

  return email.endsWith(`@${domain}`);
}