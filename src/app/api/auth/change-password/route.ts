import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { requireSameOrigin } from "@/src/lib/security";

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(
        1,
        "Password lama wajib diisi.",
      )
      .max(72),

    newPassword: z
      .string()
      .min(
        8,
        "Password baru minimal 8 karakter.",
      )
      .max(
        72,
        "Password baru maksimal 72 karakter.",
      )
      .regex(
        /[A-Z]/,
        "Password baru harus memiliki minimal 1 huruf kapital.",
      )
      .regex(
        /[a-z]/,
        "Password baru harus memiliki minimal 1 huruf kecil.",
      )
      .regex(
        /[0-9]/,
        "Password baru harus memiliki minimal 1 angka.",
      )
      .regex(
        /[^A-Za-z0-9]/,
        "Password baru harus memiliki minimal 1 karakter khusus.",
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
        "Password baru dan konfirmasi password tidak sama.",
      path: ["confirmPassword"],
    },
  );

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        { status: 401 },
      );
    }

    const body = await request.json();

    const result =
      changePasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Data password tidak valid.",
          errors:
            result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      currentPassword,
      newPassword,
    } = result.data;

    const user =
      await prisma.user.findUnique({
        where: {
          id: session.userId,
        },
        select: {
          id: true,
          passwordHash: true,
          isActive: true,
        },
      });

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          message:
            "Akun tidak dapat digunakan.",
        },
        { status: 401 },
      );
    }

    const passwordMatch =
      await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );

    if (!passwordMatch) {
      return NextResponse.json(
        {
          message:
            "Password lama salah.",
        },
        { status: 401 },
      );
    }

    const samePassword =
      await bcrypt.compare(
        newPassword,
        user.passwordHash,
      );

    if (samePassword) {
      return NextResponse.json(
        {
          message:
            "Password baru harus berbeda dari password lama.",
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
          id: user.id,
        },
        data: {
          passwordHash,
        },
      }),

      prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
        },
      }),
    ]);

    /*
     * Untuk arsitektur JWT saat ini:
     * session yang sedang aktif masih dapat hidup
     * sampai expiry.
     *
     * Setelah schema sessionVersion ditambahkan,
     * bagian ini akan dibuat invalidate semua session.
     */

    return NextResponse.json(
      {
        message:
          "Password berhasil diubah.",
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
      "CHANGE_PASSWORD_ERROR:",
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