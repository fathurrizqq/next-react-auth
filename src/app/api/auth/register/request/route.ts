// POST /api/auth/register/request
// Langkah 1 registrasi: validasi data, lalu kirim kode OTP ke email.
// Akun BELUM dibuat di tahap ini.

import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { issueOtp } from "@/src/lib/otp";
import { sendOtpEmail } from "@/src/lib/mail";
import {
  isAllowedEmailDomain,
  jsonResponse,
  readJson,
  requireSameOrigin,
  tooManyRequests,
} from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";
import {
  emailSchema,
  nameSchema,
  passwordSchema,
} from "@/src/lib/validation";

// Aturan data registrasi: nama, email, dan password yang kuat.
const schema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

// Pesan yang sama untuk email baru maupun yang sudah terdaftar
// (mencegah orang menebak email mana yang terdaftar).
const GENERIC_MESSAGE =
  "Jika email dapat digunakan, kode verifikasi telah dikirim ke email tersebut.";

// Alur: cek origin -> rate limit -> validasi -> kirim OTP.
export async function POST(request: Request) {
  try {
    // Proteksi CSRF: tolak request yang tidak berasal dari website ini.
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    // IP pengunjung untuk rate limit.
    const ip = getClientIp(request);

    // Maksimal 20 permintaan registrasi per IP per jam.
    const byIp = rateLimit(
      `register-request:${ip}`,
      20,
      60 * 60 * 1000,
    );

    // Melebihi batas -> 429.
    if (!byIp.success) {
      return tooManyRequests();
    }

    // Validasi isi request dengan zod (tidak melempar error jika salah).
    const result = schema.safeParse(await readJson(request));

    // Data tidak sesuai aturan -> 400 beserta pesan error per field.
    if (!result.success) {
      return jsonResponse(
        {
          message: "Data registrasi tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    // Data yang sudah bersih dan tervalidasi.
    const { name, email, password } = result.data;

    // Jika ALLOWED_EMAIL_DOMAIN diisi, hanya email dari domain itu yang boleh.
    // Kosong = semua email boleh.
    if (!isAllowedEmailDomain(email)) {
      return jsonResponse(
        {
          message: `Gunakan email @${process.env.ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "")}.`,
        },
        400,
      );
    }

    // Hash selalu dihitung agar waktu respons sama,
    // baik email sudah terdaftar maupun belum.
    const passwordHash = await bcrypt.hash(password, 12);

    // Cek apakah email sudah terdaftar.
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Hanya kirim OTP jika email belum dipakai. Jika sudah dipakai, diam-diam lewati
    // (respons ke user tetap sama).
    if (!existing) {
      // Buat OTP baru. Gagal bila OTP sebelumnya baru dikirim (jeda kirim ulang 60 detik).
      const otp = await issueOtp({
        purpose: "REGISTER",
        email,
        // Data pendaftar disimpan sementara bersama OTP; baru menjadi akun setelah kode benar.
        payload: { name, passwordHash },
      });

      if (otp.ok) {
        // Tanpa await agar waktu respons sama untuk semua kasus.
        sendOtpEmail(email, "REGISTER", otp.code).catch((error) => {
          // Catat detail error di log server saja; user hanya menerima pesan umum.
          console.error("REGISTER_OTP_EMAIL_ERROR:", error);
        });
      }
    }

    // Respons sama untuk email baru maupun yang sudah terdaftar.
    return jsonResponse({ message: GENERIC_MESSAGE });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("REGISTER_REQUEST_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}