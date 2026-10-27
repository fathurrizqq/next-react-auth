// POST /api/auth/change-email/request
// Langkah 1 ganti email: cek password & batas seminggu, lalu kirim OTP ke EMAIL BARU.

import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { issueOtp } from "@/src/lib/otp";
import { sendOtpEmail } from "@/src/lib/mail";
import {
  isAllowedEmailDomain,
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
import { emailSchema } from "@/src/lib/validation";

// Aturan data: email baru dan password saat ini.
const schema = z.object({
  newEmail: emailSchema,
  password: z.string().min(1, "Password wajib diisi.").max(72),
});

// Alur: cek origin -> login -> rate limit -> validasi -> cek password -> cek batas seminggu
// -> cek email baru belum dipakai -> kirim OTP ke email baru.
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
      `change-email-request:${session.userId}`,
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

    // Data yang sudah bersih dan tervalidasi.
    const { newEmail, password } = result.data;

    // Ambil data user dari database.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        emailChangedAt: true,
        isActive: true,
      },
    });

    // Akun tidak ditemukan atau sudah dinonaktifkan -> permintaan ditolak.
    if (!user || !user.isActive) {
      return unauthorized();
    }

    // Bandingkan password yang diketik dengan hash di database.
    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    // Password salah -> 401.
    if (!passwordMatch) {
      return jsonResponse({ message: "Password salah." }, 401);
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

    // Email baru sama dengan email sekarang -> tidak ada yang diubah.
    if (newEmail === user.email) {
      return jsonResponse(
        { message: "Email baru sama dengan email saat ini." },
        400,
      );
    }

    // Jika ALLOWED_EMAIL_DOMAIN diisi, email baru harus dari domain itu. Kosong = bebas.
    if (!isAllowedEmailDomain(newEmail)) {
      return jsonResponse(
        {
          message: `Gunakan email @${process.env.ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "")}.`,
        },
        400,
      );
    }

    // Pastikan email baru belum dipakai user lain.
    const taken = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });

    // Sudah dipakai -> 409.
    if (taken) {
      return jsonResponse({ message: "Email sudah digunakan." }, 409);
    }

    // Buat OTP baru. Gagal bila OTP sebelumnya baru dikirim (jeda kirim ulang 60 detik).
    const otp = await issueOtp({
      purpose: "CHANGE_EMAIL",
      email: newEmail,
      userId: user.id,
    });

    // Masih dalam jeda kirim ulang -> 429 beserta sisa detiknya.
    if (!otp.ok) {
      return tooManyRequests(
        `Tunggu ${otp.retryAfterSeconds} detik sebelum meminta kode lagi.`,
      );
    }

    // Kode dikirim ke email BARU untuk membuktikan email itu memang milik user.
    await sendOtpEmail(newEmail, "CHANGE_EMAIL", otp.code);

    return jsonResponse({
      message: "Kode verifikasi telah dikirim ke email baru Anda.",
    });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("CHANGE_EMAIL_REQUEST_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}