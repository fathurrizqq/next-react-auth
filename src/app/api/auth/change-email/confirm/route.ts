import { z } from "zod";

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
import { isUniqueConstraintError } from "@/src/lib/errors";
import {
  formatChangeLimitMessage,
  getNextChangeDate,
} from "@/src/lib/change-limit";
import { emailSchema, otpCodeSchema } from "@/src/lib/validation";

const schema = z.object({
  newEmail: emailSchema,
  code: otpCodeSchema,
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
      `change-email-confirm:${session.userId}`,
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
          message: "Data tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { newEmail, code } = result.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        emailChangedAt: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return unauthorized();
    }

    const nextDate = getNextChangeDate(user.emailChangedAt);

    if (nextDate) {
      return jsonResponse(
        { message: formatChangeLimitMessage("Email", nextDate) },
        429,
      );
    }

    const verified = await verifyOtp({
      purpose: "CHANGE_EMAIL",
      email: newEmail,
      code,
      userId: user.id,
    });

    if (!verified) {
      return jsonResponse(
        { message: "Kode tidak valid atau sudah kedaluwarsa." },
        400,
      );
    }

    const oldEmail = user.email;

    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { email: newEmail, emailChangedAt: new Date() },
        }),
        prisma.session.deleteMany({
          where: {
            userId: user.id,
            id: { not: session.sessionId },
          },
        }),
      ]);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return jsonResponse({ message: "Email sudah digunakan." }, 409);
      }

      throw error;
    }

    await logActivity({
      request,
      action: "EMAIL_CHANGED",
      actorId: user.id,
      actorEmail: newEmail,
      detail: `${oldEmail} → ${newEmail}`,
    });

    // Notifikasi ke email LAMA, supaya pemilik asli tahu jika
    // akun diambil alih.
    notifyUser(
      oldEmail,
      "Email Akun Anda Telah Diubah",
      `Email akun Anda diubah menjadi ${newEmail}. Sesi login di perangkat lain telah dikeluarkan.`,
    );

    return jsonResponse({
      message: "Email berhasil diubah.",
      email: newEmail,
    });
  } catch (error) {
    console.error("CHANGE_EMAIL_CONFIRM_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}