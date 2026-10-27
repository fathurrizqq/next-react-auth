// POST /api/auth/register/verify
// Langkah 2 registrasi: cocokkan OTP, lalu buat akun.
// Akun dibuat NONAKTIF sampai Super Admin mengaktifkannya.

import { z } from "zod";

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
import { isUniqueConstraintError } from "@/src/lib/errors";
import { emailSchema, otpCodeSchema } from "@/src/lib/validation";

// Aturan data: email dan kode OTP 6 digit.
const schema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});

// Pesan untuk semua jenis kegagalan OTP (tidak membedakan penyebabnya).
const INVALID_CODE = "Kode tidak valid atau sudah kedaluwarsa.";

// Pesan sukses: menjelaskan bahwa akun masih menunggu aktivasi.
const SUCCESS_MESSAGE =
  "Registrasi berhasil. Akun Anda menunggu aktivasi oleh Super Admin. " +
  "Anda dapat login setelah akun diaktifkan.";

/*
 * Beri tahu semua Super Admin aktif bahwa ada registrasi baru.
 * Gagal kirim email tidak boleh menggagalkan registrasi.
 */
async function notifySuperAdmins(name: string, email: string) {
  try {
    // Ambil email semua Super Admin yang aktif.
    const superAdmins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: { email: true },
    });

    // Kirim satu email ke masing-masing Super Admin.
    for (const admin of superAdmins) {
      // Kirim email pemberitahuan di latar belakang (kegagalan tidak membatalkan proses).
      notifyUser(
        admin.email,
        "Registrasi Baru Menunggu Aktivasi",
        `${name} (${email}) baru mendaftar dan menunggu aktivasi. ` +
          "Buka halaman User Management untuk mengaktifkan atau menolak akun ini.",
        { footer: "" },
      );
    }
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("NOTIFY_SUPER_ADMINS_ERROR:", error);
  }
}

// Alur: cek origin -> rate limit -> validasi -> cocokkan OTP -> buat akun nonaktif
// -> catat log -> beri tahu Super Admin.
export async function POST(request: Request) {
  try {
    // Proteksi CSRF: tolak request yang tidak berasal dari website ini.
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    // Batasi jumlah percobaan agar tidak bisa di-brute force / di-spam.
    const limit = rateLimit(
      `register-verify:${getClientIp(request)}`,
      30,
      10 * 60 * 1000,
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
          message: "Data verifikasi tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { email, code } = result.data;

    // Cocokkan kode OTP (sekali pakai, maksimal 5 percobaan).
    const verified = await verifyOtp({
      purpose: "REGISTER",
      email,
      code,
    });

    // Ambil data pendaftar (nama & hash password) yang disimpan pada langkah 1.
    const payload = verified?.payload as {
      name?: unknown;
      passwordHash?: unknown;
    } | null;

    // Pastikan OTP valid DAN data pendaftarnya lengkap serta bertipe benar.
    if (
      !verified ||
      !payload ||
      typeof payload.name !== "string" ||
      typeof payload.passwordHash !== "string"
    ) {
      return jsonResponse({ message: INVALID_CODE }, 400);
    }

    try {
      // Buat akun baru. Role selalu USER: user tidak bisa menentukan role sendiri.
      const user = await prisma.user.create({
        data: {
          name: payload.name,
          email,
          passwordHash: payload.passwordHash,
          role: "USER",

          /*
           * Akun baru nonaktif sampai Super Admin mengaktifkannya.
           */
          isActive: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      // Catat ke log aktivitas (tampil di halaman User Management).
      await logActivity({
        request,
        action: "REGISTER",
        actorId: user.id,
        actorEmail: user.email,
        detail: "Menunggu aktivasi Super Admin",
      });

      // Beri tahu Super Admin bahwa ada pendaftar baru.
      await notifySuperAdmins(user.name, user.email);

      return jsonResponse(
        { message: SUCCESS_MESSAGE, user },
        201,
      );
    } catch (error) {
      // Email ternyata sudah dipakai (mis. dua request bersamaan) -> 409.
      if (isUniqueConstraintError(error)) {
        return jsonResponse({ message: "Email sudah terdaftar." }, 409);
      }

      // Error lain dilempar ke catch terluar -> 500.
      throw error;
    }
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("REGISTER_VERIFY_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}