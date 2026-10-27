// otp.ts
// Pembuatan & pengecekan kode OTP 6 digit yang dikirim lewat email.
// OTP disimpan sebagai hash (HMAC), berlaku 10 menit, sekali pakai, maksimal 5 percobaan.

import { createHmac, randomInt, timingSafeEqual } from "crypto";

import { prisma } from "@/src/lib/prisma";

// Tujuan OTP. Harus sama dengan enum OtpPurpose di schema.prisma.
export type OtpPurposeName =
  | "REGISTER"
  | "RESET_PASSWORD"
  | "CHANGE_PASSWORD"
  | "CHANGE_EMAIL";

// Kode berlaku 10 menit.
const OTP_TTL_MS = 10 * 60 * 1000;
// Jeda minimal 60 detik sebelum kode baru boleh diminta.
const RESEND_COOLDOWN_MS = 60 * 1000;
// Maksimal 5 kali salah memasukkan kode.
const MAX_ATTEMPTS = 5;

// Ambil AUTH_SECRET (kunci rahasia untuk HMAC) dari .env. Wajib minimal 32 karakter.
function getSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET belum diset atau kurang dari 32 karakter.",
    );
  }

  return secret;
}

// Hash kode OTP dengan HMAC-SHA256 + rahasia server. Dicampur dengan tujuan dan email
// agar kode tidak bisa dipakai untuk keperluan/akun lain. Kode asli tidak pernah disimpan.
function hashCode(
  purpose: OtpPurposeName,
  email: string,
  code: string,
): string {
  return createHmac("sha256", getSecret())
    .update(`${purpose}:${email}:${code}`)
    .digest("hex");
}

// Perbandingan dengan waktu konstan (mencegah timing attack).
function safeEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return (
    first.length === second.length && timingSafeEqual(first, second)
  );
}

// Data yang dibutuhkan untuk membuat OTP.
type IssueOtpInput = {
  purpose: OtpPurposeName;
  email: string;
  // Pemilik OTP (kosong untuk registrasi karena akun belum ada).
  userId?: string;
  // Data tambahan yang disimpan bersama OTP (registrasi: nama & hash password).
  payload?: Record<string, string>;
};

// Berhasil -> kode asli dikembalikan (untuk dikirim lewat email).
// Gagal -> berapa detik lagi boleh kirim ulang.
export type IssueOtpResult =
  | { ok: true; code: string }
  | { ok: false; retryAfterSeconds: number };

/*
 * Membuat OTP baru (menggantikan yang lama untuk purpose + email yang sama).
 */
export async function issueOtp({
  purpose,
  email,
  userId,
  payload,
}: IssueOtpInput): Promise<IssueOtpResult> {
  // Cek OTP terakhir untuk email + tujuan ini.
  const latest = await prisma.otpCode.findFirst({
    where: { purpose, email },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  // Kalau OTP sebelumnya dikirim kurang dari 60 detik lalu, tolak.
  if (latest) {
    const waitMs =
      latest.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now();

    if (waitMs > 0) {
      return {
        ok: false,
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      };
    }
  }

  // Buat kode 6 digit acak (aman secara kriptografi), mis. "004281".
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  // Hapus OTP lama (milik email + tujuan ini dan yang sudah kedaluwarsa),
  // lalu simpan OTP baru (hash saja).
  await prisma.$transaction([
    prisma.otpCode.deleteMany({
      where: {
        OR: [
          { purpose, email },
          { expiresAt: { lt: new Date() } },
        ],
      },
    }),
    prisma.otpCode.create({
      data: {
        purpose,
        email,
        userId: userId ?? null,
        codeHash: hashCode(purpose, email, code),
        payload,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    }),
  ]);

  return { ok: true, code };
}

// Data yang dibutuhkan untuk memeriksa OTP.
type VerifyOtpInput = {
  purpose: OtpPurposeName;
  email: string;
  code: string;
  userId?: string;
};

// Hasil OTP yang benar: pemilik OTP dan data tambahannya.
export type VerifiedOtp = {
  userId: string | null;
  payload: unknown;
};

/*
 * Memverifikasi OTP. Berhasil = OTP langsung dihapus (sekali pakai).
 * Semua kegagalan mengembalikan null tanpa membedakan penyebabnya.
 */
export async function verifyOtp({
  purpose,
  email,
  code,
  userId,
}: VerifyOtpInput): Promise<VerifiedOtp | null> {
  // Ambil OTP terbaru untuk email + tujuan ini.
  const record = await prisma.otpCode.findFirst({
    where: { purpose, email },
    orderBy: { createdAt: "desc" },
  });

  // Tidak ada OTP -> gagal.
  if (!record) {
    return null;
  }

  // Sudah kedaluwarsa -> hapus dan gagal.
  if (record.expiresAt <= new Date()) {
    await prisma.otpCode.deleteMany({ where: { id: record.id } });
    return null;
  }

  // OTP ini milik user lain -> gagal.
  if (userId && record.userId !== userId) {
    return null;
  }

  // Hitung percobaan secara atomik sebelum membandingkan kode.
  const attempt = await prisma.otpCode.updateMany({
    where: { id: record.id, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });

  // Sudah 5 kali percobaan -> OTP terkunci.
  if (attempt.count === 0) {
    return null;
  }

  // Kode salah -> gagal.
  if (!safeEqual(hashCode(purpose, email, code), record.codeHash)) {
    return null;
  }

  // Hapus OTP agar tidak bisa dipakai lagi (sekali pakai).
  const consumed = await prisma.otpCode.deleteMany({
    where: { id: record.id },
  });

  // Sudah terhapus = dipakai oleh request lain yang bersamaan -> gagal.
  if (consumed.count === 0) {
    return null;
  }

  // OTP benar: kembalikan pemilik OTP dan data tambahannya.
  return {
    userId: record.userId,
    payload: record.payload,
  };
}