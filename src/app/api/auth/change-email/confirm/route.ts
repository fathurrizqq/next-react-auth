// POST /api/auth/change-email/confirm
// Langkah 2 ganti email: cocokkan OTP dari email baru, lalu ganti email akun.

import { z } from "zod";

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
import { isUniqueConstraintError } from "@/src/lib/errors";
import {
  formatChangeLimitMessage,
  getNextChangeDate,
} from "@/src/lib/change-limit";
import { emailSchema, otpCodeSchema } from "@/src/lib/validation";

// Aturan data: email baru dan kode OTP 6 digit.
const schema = z.object({
  newEmail: emailSchema,
  code: otpCodeSchema,
});

// Alur: cek origin -> login -> rate limit -> validasi -> cek batas seminggu
// -> cocokkan OTP -> ganti email -> keluarkan perangkat lain -> catat & beri tahu.
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
      `change-email-confirm:${session.userId}`,
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
          message: "Data tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    // Data yang sudah bersih dan tervalidasi.
    const { newEmail, code } = result.data;

    // Ambil data user dari database.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        emailChangedAt: true,
        isActive: true,
      },
    });

    // Akun tidak ditemukan atau sudah dinonaktifkan -> permintaan ditolak.
    if (!user || !user.isActive) {
      return unauthorized();
    }

    // Cek batas ganti seminggu sekali. nextDate terisi bila belum boleh.
    const nextDate = getNextChangeDate(user.emailChangedAt);

    // Belum lewat seminggu sejak perubahan terakhir -> 429.
    if (nextDate) {
      return jsonResponse(
        { message: formatChangeLimitMessage("Email", nextDate) },
        429,
      );
    }

    // Cocokkan kode OTP (sekali pakai, maksimal 5 percobaan).
    const verified = await verifyOtp({
      purpose: "CHANGE_EMAIL",
      email: newEmail,
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

    // Simpan email lama untuk dikirimi pemberitahuan.
    const oldEmail = user.email;

    // Simpan email baru. Kolom email bersifat unik, jadi bisa gagal bila
    // diambil user lain pada saat yang sama.
    try {
      // Beberapa query sekaligus: semua berhasil atau semuanya dibatalkan.
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          // Ganti email dan catat waktu penggantian (dasar batas seminggu sekali).
          data: { email: newEmail, emailChangedAt: new Date() },
        }),
        // Keluarkan semua perangkat lain; sesi yang sedang dipakai tetap hidup.
        prisma.session.deleteMany({
          where: {
            userId: user.id,
            id: { not: session.sessionId },
          },
        }),
      ]);
    } catch (error) {
      // Email sudah dipakai -> 409.
      if (isUniqueConstraintError(error)) {
        return jsonResponse({ message: "Email sudah digunakan." }, 409);
      }

      // Error lain dilempar ke catch terluar -> 500.
      throw error;
    }

    // Catat ke log aktivitas (tampil di halaman User Management).
    await logActivity({
      request,
      action: "EMAIL_CHANGED",
      actorId: user.id,
      actorEmail: newEmail,
      detail: `${oldEmail} → ${newEmail}`,
    });

    // Notifikasi ke email LAMA, supaya pemilik asli tahu jika
    // akun diambil alih.
    notifyUser(
      oldEmail,
      "Email Akun Anda Telah Diubah",
      `Email akun Anda diubah menjadi ${newEmail}. Sesi login di perangkat lain telah dikeluarkan.`,
    );

    return jsonResponse({
      message: "Email berhasil diubah.",
      email: newEmail,
    });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("CHANGE_EMAIL_CONFIRM_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}