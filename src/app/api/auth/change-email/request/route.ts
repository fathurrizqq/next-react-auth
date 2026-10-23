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

const schema = z.object({
  newEmail: emailSchema,
  password: z.string().min(1, "Password wajib diisi.").max(72),
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
      `change-email-request:${session.userId}`,
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

    const { newEmail, password } = result.data;

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

    if (!user || !user.isActive) {
      return unauthorized();
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatch) {
      return jsonResponse({ message: "Password salah." }, 401);
    }

    const nextDate = getNextChangeDate(user.emailChangedAt);

    if (nextDate) {
      return jsonResponse(
        { message: formatChangeLimitMessage("Email", nextDate) },
        429,
      );
    }

    if (newEmail === user.email) {
      return jsonResponse(
        { message: "Email baru sama dengan email saat ini." },
        400,
      );
    }

    if (!isAllowedEmailDomain(newEmail)) {
      return jsonResponse(
        {
          message: `Gunakan email @${process.env.ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "")}.`,
        },
        400,
      );
    }

    const taken = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });

    if (taken) {
      return jsonResponse({ message: "Email sudah digunakan." }, 409);
    }

    const otp = await issueOtp({
      purpose: "CHANGE_EMAIL",
      email: newEmail,
      userId: user.id,
    });

    if (!otp.ok) {
      return tooManyRequests(
        `Tunggu ${otp.retryAfterSeconds} detik sebelum meminta kode lagi.`,
      );
    }

    await sendOtpEmail(newEmail, "CHANGE_EMAIL", otp.code);

    return jsonResponse({
      message: "Kode verifikasi telah dikirim ke email baru Anda.",
    });
  } catch (error) {
    console.error("CHANGE_EMAIL_REQUEST_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}