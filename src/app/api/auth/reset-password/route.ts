import { NextResponse } from "next/server";
import {
  createHash,
} from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import {
  requireSameOrigin,
} from "@/src/lib/security";

const resetPasswordSchema =
  z
    .object({
      token: z
        .string()
        .min(
          1,
          "Token reset tidak valid.",
        ),

      newPassword: z
        .string()
        .min(
          8,
          "Password minimal 8 karakter.",
        )
        .max(
          72,
          "Password maksimal 72 karakter.",
        )
        .regex(
          /[A-Z]/,
          "Password harus memiliki huruf kapital.",
        )
        .regex(
          /[a-z]/,
          "Password harus memiliki huruf kecil.",
        )
        .regex(
          /[0-9]/,
          "Password harus memiliki angka.",
        )
        .regex(
          /[^A-Za-z0-9]/,
          "Password harus memiliki karakter khusus.",
        ),

      confirmPassword: z
        .string()
        .min(
          1,
          "Konfirmasi password wajib diisi.",
        )
        .max(72),
    })
    .refine(
      (data) =>
        data.newPassword ===
        data.confirmPassword,
      {
        message:
          "Password dan konfirmasi password tidak sama.",
        path: ["confirmPassword"],
      },
    );

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
      resetPasswordSchema.safeParse(
        body,
      );

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Data reset password tidak valid.",
          errors:
            result.error.flatten()
              .fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      token,
      newPassword,
    } = result.data;

    const tokenHash =
      createHash("sha256")
        .update(token)
        .digest("hex");

    const resetToken =
      await prisma.passwordResetToken.findUnique(
        {
          where: {
            tokenHash,
          },
          select: {
            id: true,
            userId: true,
            expiresAt: true,
            user: {
              select: {
                id: true,
                isActive: true,
              },
            },
          },
        },
      );

    if (!resetToken) {
      return NextResponse.json(
        {
          message:
            "Token reset tidak valid atau sudah digunakan.",
        },
        { status: 400 },
      );
    }

    if (
      resetToken.expiresAt <
      new Date()
    ) {
      await prisma.passwordResetToken.delete({
        where: {
          id: resetToken.id,
        },
      });

      return NextResponse.json(
        {
          message:
            "Token reset sudah kedaluwarsa.",
        },
        { status: 400 },
      );
    }

    if (
      !resetToken.user ||
      !resetToken.user.isActive
    ) {
      return NextResponse.json(
        {
          message:
            "Token reset tidak dapat digunakan.",
        },
        { status: 400 },
      );
    }

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12,
      );

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          passwordHash,
        },
      }),

      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
        },
      }),
    ]);

    return NextResponse.json(
      {
        message:
          "Password berhasil direset.",
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
      "RESET_PASSWORD_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
}