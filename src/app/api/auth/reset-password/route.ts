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

const schema = z
  .object({
    email: emailSchema,
    code: otpCodeSchema,
    newPassword: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
  .refine(passwordsMatch, PASSWORD_MISMATCH);

const INVALID_CODE = "Kode tidak valid atau sudah kedaluwarsa.";
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const result = schema.safeParse(await readJson(request));

    if (!result.success) {
      return jsonResponse(
        {
          message: "Data reset password tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { email, code, newPassword } = result.data;
    const ip = getClientIp(request);

    const byEmail = rateLimit(`reset:${ip}:${email}`, 10, WINDOW_MS);
    const byIp = rateLimit(`reset:${ip}`, 30, WINDOW_MS);

    if (!byEmail.success || !byIp.success) {
      return tooManyRequests();
    }

    const verified = await verifyOtp({
      purpose: "RESET_PASSWORD",
      email,
      code,
    });

    if (!verified?.userId) {
      return jsonResponse({ message: INVALID_CODE }, 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: { id: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return jsonResponse({ message: INVALID_CODE }, 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Keluarkan semua perangkat.
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    await logActivity({
      request,
      action: "PASSWORD_RESET",
      actorId: user.id,
      actorEmail: user.email,
    });

    notifyUser(
      user.email,
      "Password Anda Telah Direset",
      "Password akun Anda baru saja direset. Semua sesi login telah dikeluarkan.",
    );

    return jsonResponse({ message: "Password berhasil direset." });
  } catch (error) {
    console.error("RESET_PASSWORD_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}