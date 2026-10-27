// POST /api/auth/login
// Memeriksa email & password, lalu membuat sesi login (cookie).

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { createSession } from "@/src/lib/session";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
  tooManyRequests,
} from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";
import { logActivity } from "@/src/lib/audit";

// Aturan data yang boleh dikirim ke endpoint login.
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .toLowerCase()
    .email("Format email tidak valid."),

  password: z
    .string()
    .min(1, "Password wajib diisi.")
    .max(72, "Password terlalu panjang."),
});

/*
 * Batas per IP sengaja longgar karena satu kantor biasanya berbagi
 * satu IP. Batas per IP + email yang menahan brute force.
 */
// Maksimal 5 percobaan per kombinasi (IP + email).
const LOGIN_PER_EMAIL = 5;
// Maksimal 100 percobaan per IP (longgar karena satu kantor berbagi satu IP).
const LOGIN_PER_IP = 100;
// Semua batas di atas dihitung dalam jendela 10 menit.
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

/*
 * Hash dummy agar waktu respons "email tidak ada" sama dengan
 * "password salah" (mencegah enumerasi email lewat timing).
 */
let dummyHash: string | null = null;

// Hash palsu (dibuat sekali) untuk dibandingkan saat email tidak terdaftar.
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync("dummy-password-timing-safety", 12);
  return dummyHash;
}

// Alur: cek origin -> validasi -> rate limit -> cari user -> cek password
// -> cek akun aktif -> buat sesi.
export async function POST(request: Request) {
  try {
    // Proteksi CSRF: tolak request yang tidak berasal dari website ini.
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    // Validasi isi request dengan zod (tidak melempar error jika salah).
    const result = loginSchema.safeParse(await readJson(request));

    // Data tidak sesuai aturan -> 400 beserta pesan error per field.
    if (!result.success) {
      return jsonResponse(
        {
          message: "Data login tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { email, password } = result.data;
    // IP pengunjung, dipakai sebagai bagian kunci rate limit.
    const ip = getClientIp(request);

    // Hitung percobaan per IP + email (menahan brute force pada satu akun).
    const byEmail = rateLimit(
      `login:${ip}:${email}`,
      LOGIN_PER_EMAIL,
      LOGIN_WINDOW_MS,
    );

    // Hitung percobaan per IP (menahan satu IP yang mencoba banyak akun).
    const byIp = rateLimit(
      `login:${ip}`,
      LOGIN_PER_IP,
      LOGIN_WINDOW_MS,
    );

    // Salah satu batas terlewati -> 429.
    if (!byEmail.success || !byIp.success) {
      return tooManyRequests(
        "Terlalu banyak percobaan login. Silakan coba lagi beberapa menit lagi.",
      );
    }

    // Cari user berdasarkan email.
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    // Selalu jalankan bcrypt.compare, walau email tidak ada (pakai hash palsu),
    // supaya waktu respons sama dan email terdaftar tidak bisa ditebak lewat timing.
    const passwordMatch = await bcrypt.compare(
      password,
      user?.passwordHash ?? getDummyHash(),
    );

    // Email tidak ada ATAU password salah: pesannya sama persis agar tidak
    // membocorkan email mana yang terdaftar.
    if (!user || !passwordMatch) {
      // Catat percobaan gagal hanya untuk akun yang memang ada.
      if (user) {
        // Catat ke log aktivitas (tampil di halaman User Management).
        await logActivity({
          request,
          action: "LOGIN_FAILED",
          actorId: user.id,
          actorEmail: user.email,
        });
      }

      return jsonResponse({ message: "Email atau password salah." }, 401);
    }

    /*
     * Pesan ini hanya terlihat oleh orang yang password-nya benar,
     * jadi tidak bisa dipakai untuk menebak email yang terdaftar.
     */
    if (!user.isActive) {
      // Catat ke log aktivitas (tampil di halaman User Management).
      await logActivity({
        request,
        action: "LOGIN_FAILED",
        actorId: user.id,
        actorEmail: user.email,
        detail: "Akun belum aktif",
      });

      return jsonResponse(
        {
          message:
            "Akun Anda belum aktif. Mohon tunggu aktivasi dari Super Admin.",
        },
        403,
      );
    }

    // Semua pemeriksaan lolos: buat sesi dan pasang cookie login.
    await createSession(user.id);

    // Catat ke log aktivitas (tampil di halaman User Management).
    await logActivity({
      request,
      action: "LOGIN",
      actorId: user.id,
      actorEmail: user.email,
    });

    // Kirim data user (tanpa passwordHash) ke browser.
    return NextResponse.json(
      {
        message: "Login berhasil.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("LOGIN_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}