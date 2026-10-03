import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";

const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(
        1,
        "Password lama wajib diisi.",
      ),

    newPassword: z
      .string()
      .min(
        8,
        "Password baru minimal 8 karakter.",
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
      ),
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

export async function POST(
  request: Request,
) {
  try {
    // ================================
    // 1. CEK SESSION
    // ================================

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        {
          status: 401,
        },
      );
    }

    // ================================
    // 2. AMBIL BODY
    // ================================

    const body = await request.json();

    // ================================
    // 3. VALIDASI DATA
    // ================================

    const result =
      changePasswordSchema.safeParse(
        body,
      );

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Data password tidak valid.",
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
      currentPassword,
      newPassword,
    } = result.data;

    // ================================
    // 4. CARI USER
    // ================================

    const user =
      await prisma.user.findUnique({
        where: {
          id: session.userId,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          message:
            "User tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    // ================================
    // 5. CEK PASSWORD LAMA
    // ================================

    const passwordMatch =
      await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );

    if (!passwordMatch) {
      return NextResponse.json(
        {
          message:
            "Password lama yang kamu masukkan salah.",
        },
        {
          status: 401,
        },
      );
    }

    // ================================
    // 6. CEK PASSWORD BARU
    // ================================

    const samePassword =
      await bcrypt.compare(
        newPassword,
        user.passwordHash,
      );

    if (samePassword) {
      return NextResponse.json(
        {
          message:
            "Password baru tidak boleh sama dengan password lama.",
        },
        {
          status: 400,
        },
      );
    }

    // ================================
    // 7. HASH PASSWORD BARU
    // ================================

    const newPasswordHash =
      await bcrypt.hash(
        newPassword,
        12,
      );

    // ================================
    // 8. UPDATE DATABASE
    // ================================

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash:
          newPasswordHash,
      },
    });

    // ================================
    // 9. RESPONSE
    // ================================

    return NextResponse.json({
      message:
        "Password berhasil diubah.",
    });
  } catch (error) {
    console.error(
      "CHANGE_PASSWORD_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat mengubah password.",
      },
      {
        status: 500,
      },
    );
  }
}
