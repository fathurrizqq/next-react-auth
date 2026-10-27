// POST /api/auth/change-password/request
// Langkah 1 ganti password: verifikasi password lama, lalu kirim OTP ke email akun.

import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { issueOtp } from "@/src/lib/otp";
import { sendOtpEmail } from "@/src/lib/mail";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
  tooManyRequests,
  unauthorized,
} from "@/src/lib/security";
import { rateLimit } from "@/src/lib/rate-limit";
import {
  formatChangeLimitMessage,
  getNextChangeDate,
} from "@/src/lib/change-limit";

// Aturan data: password lama wajib diisi.
const schema = z.object({
  currentPassword: z
    .string()
    .min(1, "Password lama wajib diisi.")
    .max(72),
});

// Alur: cek origin -> login -> rate limit -> validasi -> cek password lama
// -> cek batas seminggu -> kirim OTP.
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

    // Maksimal 5 permintaan per user dalam 15 menit.
    const limit = rateLimit(
      `change-password-request:${session.userId}`,
      5,
      15 * 60 * 1000,
    );

    // Melebihi batas -> 429 (Too Many Requests).
    if (!limit.success) {
      return tooManyRequests();
    }

    // Validasi isi request dengan zod (tidak melempar error jika salah).
    const result = schema.safeParse(await readJson(request));

    // Data tidak sesuai aturan -> 400 beserta pesan error per field.
    if (!result.success) {
      return jsonResponse(
        {
          message: "Data tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    // Ambil data user dari database.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        passwordChangedAt: true,
        isActive: true,
      },
    });

    // Akun tidak ditemukan atau sudah dinonaktifkan -> permintaan ditolak.
    if (!user || !user.isActive) {
      return unauthorized();
    }

    // Bandingkan password yang diketik dengan hash di database.
    const passwordMatch = await bcrypt.compare(
      result.data.currentPassword,
      user.passwordHash,
    );

    // Password lama salah -> 401.
    if (!passwordMatch) {
      return jsonResponse({ message: "Password lama salah." }, 401);
    }

    // Cek batas ganti seminggu sekali. nextDate terisi bila belum boleh.
    const nextDate = getNextChangeDate(user.passwordChangedAt);

    // Belum lewat seminggu sejak perubahan terakhir -> 429.
    if (nextDate) {
      return jsonResponse(
        { message: formatChangeLimitMessage("Password", nextDate) },
        429,
      );
    }

    // Buat OTP baru. Gagal bila OTP sebelumnya baru dikirim (jeda kirim ulang 60 detik).
    const otp = await issueOtp({
      purpose: "CHANGE_PASSWORD",
      email: user.email,
      userId: user.id,
    });

    // Masih dalam jeda kirim ulang -> 429 beserta sisa detiknya.
    if (!otp.ok) {
      return tooManyRequests(
        `Tunggu ${otp.retryAfterSeconds} detik sebelum meminta kode lagi.`,
      );
    }

    // Kirim kode OTP ke email.
    await sendOtpEmail(user.email, "CHANGE_PASSWORD", otp.code);

    return jsonResponse({
      message: "Kode verifikasi telah dikirim ke email Anda.",
    });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("CHANGE_PASSWORD_REQUEST_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}