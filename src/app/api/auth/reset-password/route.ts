import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";

const resetPasswordSchema =
  z.object({
    token: z
      .string()
      .min(1, "Token reset tidak valid."),

    newPassword: z
      .string()
      .min(
        8,
        "Password minimal 8 karakter.",
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
      ),
  })
  .refine(
    (data) =>
      data.newPassword ===
      data.confirmPassword,
    {
      message:
        "Konfirmasi password tidak sama.",
      path: ["confirmPassword"],
    },
  );

export async function POST(
  request: Request,
) {
  try {
    const body = await request.json();

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
        {
          status: 400,
        },
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
          include: {
            user: true,
          },
        },
      );

    if (!resetToken) {
      return NextResponse.json(
        {
          message:
            "Link reset password tidak valid atau sudah digunakan.",
        },
        {
          status: 400,
        },
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
            "Link reset password sudah kedaluwarsa.",
        },
        {
          status: 400,
        },
      );
    }

    const newPasswordHash =
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
          passwordHash:
            newPasswordHash,
        },
      }),

      prisma.passwordResetToken.delete({
        where: {
          id: resetToken.id,
        },
      }),
    ]);

    return NextResponse.json({
      message:
        "Password berhasil direset. Silakan login.",
    });
  } catch (error) {
    console.error(
      "RESET_PASSWORD_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat reset password.",
      },
      {
        status: 500,
      },
    );
  }
}