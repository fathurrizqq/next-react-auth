// POST /api/auth/forgot-password
// Meminta kode reset password. Selalu menjawab sama, baik email terdaftar maupun tidak.

import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { issueOtp } from "@/src/lib/otp";
import { sendOtpEmail } from "@/src/lib/mail";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
} from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";
import { emailSchema } from "@/src/lib/validation";

// Aturan data: hanya email.
const schema = z.object({ email: emailSchema });

// Pesan yang selalu sama agar email terdaftar tidak bisa ditebak.
const GENERIC_MESSAGE =
  "Jika email terdaftar, kode reset password telah dikirim.";

// Jendela rate limit: 15 menit.
const WINDOW_MS = 15 * 60 * 1000;

// Alur: cek origin -> validasi -> rate limit -> kirim OTP (jika akun aktif).
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
      return jsonResponse({ message: "Format email tidak valid." }, 400);
    }

    const { email } = result.data;
    // IP pengunjung untuk rate limit.
    const ip = getClientIp(request);

    // Maksimal 3 permintaan per (IP + email) dalam 15 menit.
    const byEmail = rateLimit(`forgot:${ip}:${email}`, 3, WINDOW_MS);
    // Maksimal 30 permintaan per IP dalam 15 menit.
    const byIp = rateLimit(`forgot:${ip}`, 30, WINDOW_MS);

    // Selalu balas generik, jangan bocorkan status rate limit per email.
    if (!byEmail.success || !byIp.success) {
      return jsonResponse({ message: GENERIC_MESSAGE });
    }

    // Ambil data user dari database.
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    // Kirim OTP hanya untuk akun aktif. Jika tidak, diam-diam lewati (respons tetap sama).
    if (user && user.isActive) {
      // Buat OTP baru. Gagal bila OTP sebelumnya baru dikirim (jeda kirim ulang 60 detik).
      const otp = await issueOtp({
        purpose: "RESET_PASSWORD",
        email: user.email,
        userId: user.id,
      });

      if (otp.ok) {
        // Tidak di-await agar waktu respons sama untuk email
        // terdaftar dan tidak terdaftar.
        sendOtpEmail(user.email, "RESET_PASSWORD", otp.code).catch(
          (error) => {
            // Catat detail error di log server saja; user hanya menerima pesan umum.
            console.error("RESET_OTP_EMAIL_ERROR:", error);
          },
        );
      }
    }

    return jsonResponse({ message: GENERIC_MESSAGE });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("FORGOT_PASSWORD_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat memproses permintaan." },
      500,
    );
  }
}