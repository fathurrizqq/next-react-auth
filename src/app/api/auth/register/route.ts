import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/src/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          message: "Nama, email, dan password wajib diisi.",
        },
        {
          status: 400,
        },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          message: "Password minimal 6 karakter.",
        },
        {
          status: 400,
        },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          message: "Email sudah terdaftar.",
        },
        {
          status: 409,
        },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "USER",
      },
    });

    return NextResponse.json(
      {
        message: "Register berhasil.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("REGISTER_ERROR:", error);

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