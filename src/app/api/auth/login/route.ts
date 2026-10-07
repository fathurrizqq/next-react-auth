import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { createSession } from "@/src/lib/session";
import { requireSameOrigin } from "@/src/lib/security";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .toLowerCase()
    .email("Format email tidak valid."),

  password: z
    .string()
    .min(1, "Password wajib diisi.")
    .max(72, "Password terlalu panjang."),
});

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const body = await request.json();

    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message: "Data login tidak valid.",
          errors:
            result.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const {
      email,
      password,
    } = result.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    /*
     * Jangan membedakan user tidak ditemukan
     * dengan password salah.
     */
    if (!user) {
      return NextResponse.json(
        {
          message:
            "Email atau password salah.",
        },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          message:
            "Email atau password salah.",
        },
        { status: 401 },
      );
    }

    const passwordMatch =
      await bcrypt.compare(
        password,
        user.passwordHash,
      );

    if (!passwordMatch) {
      return NextResponse.json(
        {
          message:
            "Email atau password salah.",
        },
        { status: 401 },
      );
    }

    await createSession(user.id);

    return NextResponse.json(
      {
        message: "Login berhasil.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan pada server.",
      },
      { status: 500 },
    );
  }
}