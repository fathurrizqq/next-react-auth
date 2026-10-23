import { createHmac, randomInt, timingSafeEqual } from "crypto";

import { prisma } from "@/src/lib/prisma";

export type OtpPurposeName =
  | "REGISTER"
  | "RESET_PASSWORD"
  | "CHANGE_PASSWORD"
  | "CHANGE_EMAIL";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET belum diset atau kurang dari 32 karakter.",
    );
  }

  return secret;
}

function hashCode(
  purpose: OtpPurposeName,
  email: string,
  code: string,
): string {
  return createHmac("sha256", getSecret())
    .update(`${purpose}:${email}:${code}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return (
    first.length === second.length && timingSafeEqual(first, second)
  );
}

type IssueOtpInput = {
  purpose: OtpPurposeName;
  email: string;
  userId?: string;
  payload?: Record<string, string>;
};

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
  const latest = await prisma.otpCode.findFirst({
    where: { purpose, email },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

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

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

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

type VerifyOtpInput = {
  purpose: OtpPurposeName;
  email: string;
  code: string;
  userId?: string;
};

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
  const record = await prisma.otpCode.findFirst({
    where: { purpose, email },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return null;
  }

  if (record.expiresAt <= new Date()) {
    await prisma.otpCode.deleteMany({ where: { id: record.id } });
    return null;
  }

  if (userId && record.userId !== userId) {
    return null;
  }

  // Hitung percobaan secara atomik sebelum membandingkan kode.
  const attempt = await prisma.otpCode.updateMany({
    where: { id: record.id, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });

  if (attempt.count === 0) {
    return null;
  }

  if (!safeEqual(hashCode(purpose, email, code), record.codeHash)) {
    return null;
  }

  const consumed = await prisma.otpCode.deleteMany({
    where: { id: record.id },
  });

  if (consumed.count === 0) {
    return null;
  }

  return {
    userId: record.userId,
    payload: record.payload,
  };
}