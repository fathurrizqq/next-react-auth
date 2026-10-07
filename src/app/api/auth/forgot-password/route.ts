import { NextResponse } from "next/server";
import {
  randomBytes,
  createHash,
} from "crypto";
import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import {
  sendPasswordResetEmail,
} from "@/src/lib/mail";
import {
  requireSameOrigin,
} from "@/src/lib/security";

const forgotPasswordSchema =
  z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email(
        "Format email tidak valid.",
      )
      .max(254),
  });

const GENERIC_MESSAGE =
  "Jika email terdaftar, link reset password akan dikirim.";

export async function POST(request: Request) {
  try {
    const originError =
      requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const body =
      await request.json();

    const result =
      forgotPasswordSchema.safeParse(
        body,
      );

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Format email tidak valid.",
        },
        { status: 400 },
      );
    }

    const { email } = result.data;

    const user =
      await prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      });

    /*
     * Jangan memberitahu apakah email
     * benar-benar terdaftar.
     */
    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          message: GENERIC_MESSAGE,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    await prisma.passwordResetToken.deleteMany(
      {
        where: {
          userId: user.id,
        },
      },
    );

    const rawToken =
      randomBytes(32).toString("hex");

    const tokenHash =
      createHash("sha256")
        .update(rawToken)
        .digest("hex");

    const expiresAt =
      new Date(
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
      process.env.APP_URL;

    if (!appUrl) {
      throw new Error(
        "APP_URL belum diset.",
      );
    }

    const resetUrl =
      `${appUrl.replace(/\/$/, "")}` +
      `/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(
        user.email,
        resetUrl,
      );
    } catch (error) {
      await prisma.passwordResetToken.deleteMany(
        {
          where: {
            userId: user.id,
          },
        },
      );

      throw error;
    }

    return NextResponse.json(
      {
        message: GENERIC_MESSAGE,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
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
      { status: 500 },
    );
  }
}