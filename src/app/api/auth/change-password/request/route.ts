import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { issueOtp } from "@/src/lib/otp";
import { sendOtpEmail } from "@/src/lib/mail";
import {
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

const schema = z.object({
  currentPassword: z
    .string()
    .min(1, "Password lama wajib diisi.")
    .max(72),
});

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
      `change-password-request:${session.userId}`,
      5,
      15 * 60 * 1000,
    );

    if (!limit.success) {
      return tooManyRequests();
    }

    const result = schema.safeParse(await readJson(request));

    if (!result.success) {
      return jsonResponse(
        {
          message: "Data tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

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

    const passwordMatch = await bcrypt.compare(
      result.data.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatch) {
      return jsonResponse({ message: "Password lama salah." }, 401);
    }

    const nextDate = getNextChangeDate(user.passwordChangedAt);

    if (nextDate) {
      return jsonResponse(
        { message: formatChangeLimitMessage("Password", nextDate) },
        429,
      );
    }

    const otp = await issueOtp({
      purpose: "CHANGE_PASSWORD",
      email: user.email,
      userId: user.id,
    });

    if (!otp.ok) {
      return tooManyRequests(
        `Tunggu ${otp.retryAfterSeconds} detik sebelum meminta kode lagi.`,
      );
    }

    await sendOtpEmail(user.email, "CHANGE_PASSWORD", otp.code);

    return jsonResponse({
      message: "Kode verifikasi telah dikirim ke email Anda.",
    });
  } catch (error) {
    console.error("CHANGE_PASSWORD_REQUEST_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}