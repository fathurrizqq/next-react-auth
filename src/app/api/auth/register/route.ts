import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { requireSameOrigin } from "@/src/lib/security";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(4, "Nama minimal 4 karakter.")
    .max(100, "Nama maksimal 100 karakter."),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Format email tidak valid.")
    .max(254, "Email terlalu panjang."),

  password: z
    .string()
    .min(8, "Password minimal 8 karakter.")
    .max(72, "Password maksimal 72 karakter.")
    .regex(
      /[A-Z]/,
      "Password harus mengandung huruf kapital.",
    )
    .regex(
      /[a-z]/,
      "Password harus mengandung huruf kecil.",
    )
    .regex(
      /[0-9]/,
      "Password harus mengandung angka.",
    )
    .regex(
      /[^A-Za-z0-9]/,
      "Password harus mengandung karakter khusus.",
    ),
});

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const body = await request.json();

    const result =
      registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Data registrasi tidak valid.",
          errors:
            result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      name,
      email,
      password,
    } = result.data;

    const passwordHash =
      await bcrypt.hash(password, 12);

    try {
      const user =
        await prisma.user.create({
          data: {
            name,
            email,
            passwordHash,

            /*
             * PENTING:
             * Tetap gunakan role sesuai enum
             * schema.prisma kamu saat ini.
             */
            role: "USER",
          },

          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        });

      return NextResponse.json(
        {
          message:
            "Registrasi berhasil.",
          user,
        },
        {
          status: 201,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            message:
              "Email sudah terdaftar.",
          },
          { status: 409 },
        );
      }

      throw error;
    }
  } catch (error) {
    console.error(
      "REGISTER_ERROR:",
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