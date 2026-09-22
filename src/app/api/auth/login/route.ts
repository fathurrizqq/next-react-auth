import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";
import { createSession } from "@/src/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        {
          message: "Email dan password wajib diisi.",
        },
        {
          status: 400,
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          message: "Email atau password salah.",
        },
        {
          status: 401,
        },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          message: "Akun tidak aktif.",
        },
        {
          status: 403,
        },
      );
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatch) {
      return NextResponse.json(
        {
          message: "Email atau password salah.",
        },
        {
          status: 401,
        },
      );
    }

    await createSession({
      userId: user.id,
      role: user.role,
    });

    return NextResponse.json({
      message: "Login berhasil.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return NextResponse.json(
      {
        message: "Terjadi kesalahan pada server.",
      },
      {
        status: 500,
      },
    );
  }
}