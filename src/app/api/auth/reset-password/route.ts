// POST /api/auth/reset-password
// Mengatur password baru memakai kode OTP dari email (alur lupa password).

import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { verifyOtp } from "@/src/lib/otp";
import { notifyUser } from "@/src/lib/mail";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
  tooManyRequests,
} from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";
import { logActivity } from "@/src/lib/audit";
import {
  PASSWORD_MISMATCH,
  confirmPasswordSchema,
  emailSchema,
  otpCodeSchema,
  passwordSchema,
  passwordsMatch,
} from "@/src/lib/validation";

// Aturan data: email, kode 6 digit, password baru + konfirmasi (harus sama).
const schema = z
  .object({
    email: emailSchema,
    code: otpCodeSchema,
    newPassword: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH);

// Pesan untuk semua jenis kegagalan OTP.
const INVALID_CODE = "Kode tidak valid atau sudah kedaluwarsa.";
// Jendela rate limit: 15 menit.
const WINDOW_MS = 15 * 60 * 1000;

// Alur: cek origin -> validasi -> rate limit -> cocokkan OTP -> simpan password baru
// -> keluarkan semua perangkat -> catat & beri tahu.
export async function POST(request: Request) {
  try {
    // Proteksi CSRF: tolak request yang tidak berasal dari website ini.
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    // Validasi isi request dengan zod (tidak melempar error jika salah).
    const result = schema.safeParse(await readJson(request));

    // Data tidak sesuai aturan -> 400 beserta pesan error per field.
    if (!result.success) {
      return jsonResponse(
        {
          message: "Data reset password tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    // Data yang sudah bersih dan tervalidasi.
    const { email, code, newPassword } = result.data;
    // IP pengunjung untuk rate limit.
    const ip = getClientIp(request);

    // Maksimal 10 percobaan per (IP + email) dalam 15 menit.
    const byEmail = rateLimit(`reset:${ip}:${email}`, 10, WINDOW_MS);
    // Maksimal 30 percobaan per IP dalam 15 menit.
    const byIp = rateLimit(`reset:${ip}`, 30, WINDOW_MS);

    // Salah satu batas terlewati -> 429.
    if (!byEmail.success || !byIp.success) {
      return tooManyRequests();
    }

    // Cocokkan kode OTP (sekali pakai, maksimal 5 percobaan).
    const verified = await verifyOtp({
      purpose: "RESET_PASSWORD",
      email,
      code,
    });

    // OTP salah / kedaluwarsa (atau bukan OTP reset password) -> 400.
    if (!verified?.userId) {
      return jsonResponse({ message: INVALID_CODE }, 400);
    }

    // Pastikan akun pemilik OTP masih ada dan aktif.
    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: { id: true, email: true, isActive: true },
    });

    // Akun tidak ditemukan atau sudah dinonaktifkan -> permintaan ditolak.
    if (!user || !user.isActive) {
      return jsonResponse({ message: INVALID_CODE }, 400);
    }

    // Hash password dengan bcrypt cost 12 (password asli tidak pernah disimpan).
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Beberapa query sekaligus: semua berhasil atau semuanya dibatalkan.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Keluarkan semua perangkat.
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    // Catat ke log aktivitas (tampil di halaman User Management).
    await logActivity({
      request,
      action: "PASSWORD_RESET",
      actorId: user.id,
      actorEmail: user.email,
    });

    // Kirim email pemberitahuan di latar belakang (kegagalan tidak membatalkan proses).
    notifyUser(
      user.email,
      "Password Anda Telah Direset",
      "Password akun Anda baru saja direset. Semua sesi login telah dikeluarkan.",
    );

    return jsonResponse({ message: "Password berhasil direset." });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("RESET_PASSWORD_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}