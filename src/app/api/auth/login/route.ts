import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { createSession } from "@/src/lib/session";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, {
      message: "Email wajib diisi.",
    })
    .toLowerCase()
    .email({
      message: "Format email tidak valid.",
    }),

  password: z
    .string()
    .min(1, {
      message: "Password wajib diisi.",
    }),
});

export async function POST(request: Request) {
  try {
    // 1. Ambil data dari request body
    const body = await request.json();

    // 2. Validasi data menggunakan Zod
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message: "Data login tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        {
          status: 400,
        }
      );
    }

    // 3. Ambil data yang sudah divalidasi
    const { email, password } = result.data;

    // 4. Cari user berdasarkan email
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    // 5. Jika user tidak ditemukan
    if (!user) {
      return NextResponse.json(
        {
          message: "Email atau password salah.",
        },
        {
          status: 401,
        }
      );
    }

    // 6. Cek apakah akun masih aktif
    if (!user.isActive) {
      return NextResponse.json(
        {
          message: "Akun tidak aktif. Silakan hubungi administrator.",
        },
        {
          status: 403,
        }
      );
    }

    // 7. Bandingkan password dengan passwordHash
    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    // 8. Jika password salah
    if (!passwordMatch) {
      return NextResponse.json(
        {
          message: "Email atau password salah.",
        },
        {
          status: 401,
        }
      );
    }

    // 9. Buat session
    await createSession({
      userId: user.id,
      role: user.role,
    });

    // 10. Kirim response berhasil
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
      }
    );
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return NextResponse.json(
      {
        message: "Terjadi kesalahan pada server.",
      },
      {
        status: 500,
      }
    );
  }
}

