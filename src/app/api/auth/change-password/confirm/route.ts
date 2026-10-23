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

const schema = z
  .object({
    code: otpCodeSchema,
    newPassword: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH);

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const session = await getSession();

    if (!session) {
      return unauthorized();
    }

    const limit = rateLimit(
      `change-password-confirm:${session.userId}`,
      10,
      15 * 60 * 1000,
    );

    if (!limit.success) {
      return tooManyRequests();
    }

    const result = schema.safeParse(await readJson(request));

    if (!result.success) {
      return jsonResponse(
        {
          message: "Data password tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { code, newPassword } = result.data;

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

    if (!user || !user.isActive) {
      return unauthorized();
    }

    const nextDate = getNextChangeDate(user.passwordChangedAt);

    if (nextDate) {
      return jsonResponse(
        { message: formatChangeLimitMessage("Password", nextDate) },
        429,
      );
    }

    const verified = await verifyOtp({
      purpose: "CHANGE_PASSWORD",
      email: user.email,
      code,
      userId: user.id,
    });

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

    if (samePassword) {
      return jsonResponse(
        {
          message:
            "Password baru harus berbeda dari password lama. Minta kode baru untuk mengulang.",
        },
        400,
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
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

    await logActivity({
      request,
      action: "PASSWORD_CHANGED",
      actorId: user.id,
      actorEmail: user.email,
    });

    notifyUser(
      user.email,
      "Password Anda Telah Diubah",
      "Password akun Anda baru saja diubah. Sesi login di perangkat lain telah dikeluarkan.",
    );

    return jsonResponse({
      message: "Password berhasil diubah. Sesi lain telah dikeluarkan.",
    });
  } catch (error) {
    console.error("CHANGE_PASSWORD_CONFIRM_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}