import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { sendPasswordResetEmail } from "@/src/lib/mail";

const forgotPasswordSchema =
  z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email(
        "Format email tidak valid.",
      ),
  });

export async function POST(
  request: Request,
) {
  try {
    const body = await request.json();

    const result =
      forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Email tidak valid.",
          errors:
            result.error.flatten()
              .fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    const { email } = result.data;

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    // Jangan memberi tahu apakah email ada
    if (!user) {
      return NextResponse.json({
        message:
          "Jika email terdaftar, link reset password akan dikirim.",
      });
    }

    // Hapus token lama
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
      },
    });

    // Buat token random
    const rawToken =
      randomBytes(32).toString("hex");

    // Hash token sebelum disimpan
    const tokenHash =
      createHash("sha256")
        .update(rawToken)
        .digest("hex");

    // Token berlaku 30 menit
    const expiresAt = new Date(
      Date.now() +
        30 * 60 * 1000,
    );

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    const appUrl =
      process.env.APP_URL ??
      "http://localhost:3000";

    const resetUrl =
      `${appUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail(
      user.email,
      resetUrl,
    );

    return NextResponse.json({
      message:
        "Jika email terdaftar, link reset password akan dikirim.",
    });
  } catch (error) {
    console.error(
      "FORGOT_PASSWORD_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat memproses permintaan.",
      },
      {
        status: 500,
      },
    );
  }
}