// POST /api/auth/change-password/confirm
// Langkah 2 ganti password: cocokkan OTP, lalu simpan password baru.

import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { verifyOtp } from "@/src/lib/otp";
import { notifyUser } from "@/src/lib/mail";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
  tooManyRequests,
  unauthorized,
} from "@/src/lib/security";
import { rateLimit } from "@/src/lib/rate-limit";
import { logActivity } from "@/src/lib/audit";
import {
  formatChangeLimitMessage,
  getNextChangeDate,
} from "@/src/lib/change-limit";
import {
  PASSWORD_MISMATCH,
  confirmPasswordSchema,
  otpCodeSchema,
  passwordSchema,
  passwordsMatch,
} from "@/src/lib/validation";

// Aturan data: kode 6 digit, password baru + konfirmasi (harus sama).
const schema = z
  .object({
    code: otpCodeSchema,
    newPassword: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH);

// Alur: cek origin -> login -> rate limit -> validasi -> cek batas seminggu
// -> cocokkan OTP -> simpan password baru -> keluarkan perangkat lain.
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

    // Maksimal 10 percobaan per user dalam 15 menit.
    const limit = rateLimit(
      `change-password-confirm:${session.userId}`,
      10,
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
          message: "Data password tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    // Data yang sudah bersih dan tervalidasi.
    const { code, newPassword } = result.data;

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

    // Cek batas ganti seminggu sekali. nextDate terisi bila belum boleh.
    const nextDate = getNextChangeDate(user.passwordChangedAt);

    // Belum lewat seminggu sejak perubahan terakhir -> 429.
    if (nextDate) {
      return jsonResponse(
        { message: formatChangeLimitMessage("Password", nextDate) },
        429,
      );
    }

    // Cocokkan kode OTP (sekali pakai, maksimal 5 percobaan).
    const verified = await verifyOtp({
      purpose: "CHANGE_PASSWORD",
      email: user.email,
      code,
      userId: user.id,
    });

    // OTP salah / kedaluwarsa -> 400 (pesan sengaja tidak membedakan penyebabnya).
    if (!verified) {
      return jsonResponse(
        { message: "Kode tidak valid atau sudah kedaluwarsa." },
        400,
      );
    }

    // Dicek setelah OTP valid agar endpoint ini tidak bisa dipakai
    // untuk menebak password lama.
    const samePassword = await bcrypt.compare(
      newPassword,
      user.passwordHash,
    );

    // Password baru tidak boleh sama dengan yang lama.
    if (samePassword) {
      return jsonResponse(
        {
          message:
            "Password baru harus berbeda dari password lama. Minta kode baru untuk mengulang.",
        },
        400,
      );
    }

    // Hash password dengan bcrypt cost 12 (password asli tidak pernah disimpan).
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Beberapa query sekaligus: semua berhasil atau semuanya dibatalkan.
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        // Simpan hash baru dan catat waktu penggantian (dasar batas seminggu sekali).
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
      // Keluarkan semua perangkat lain, sesi ini tetap hidup.
      prisma.session.deleteMany({
        where: {
          userId: user.id,
          id: { not: session.sessionId },
        },
      }),
    ]);

    // Catat ke log aktivitas (tampil di halaman User Management).
    await logActivity({
      request,
      action: "PASSWORD_CHANGED",
      actorId: user.id,
      actorEmail: user.email,
    });

    // Kirim email pemberitahuan di latar belakang (kegagalan tidak membatalkan proses).
    notifyUser(
      user.email,
      "Password Anda Telah Diubah",
      "Password akun Anda baru saja diubah. Sesi login di perangkat lain telah dikeluarkan.",
    );

    return jsonResponse({
      message: "Password berhasil diubah. Sesi lain telah dikeluarkan.",
    });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("CHANGE_PASSWORD_CONFIRM_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}