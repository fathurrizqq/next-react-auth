import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { createSession } from "@/src/lib/session";
import { requireSameOrigin } from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";

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

/*
 * Hash dummy untuk menyamakan waktu respons antara
 * "user tidak ditemukan" dan "password salah", supaya endpoint
 * ini tidak bisa dipakai untuk enumerasi email lewat timing attack.
 * Cost-nya sengaja disamakan dengan cost hash asli (12).
 */
const DUMMY_HASH = bcrypt.hashSync(
  "dummy-password-untuk-timing-safety",
  12,
);

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 menit

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const ip = getClientIp(request);

    const body = await request.json();

    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message: "Data login tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const { email, password } = result.data;

    /*
     * Dua lapis rate limit:
     * - per IP + email: mencegah brute force ke satu akun tertentu.
     * - per IP saja (limit lebih longgar): mencegah satu IP mencoba
     *   banyak email berbeda secara berlebihan (credential stuffing).
     */
    const limitByIpAndEmail = rateLimit(
      `login:${ip}:${email}`,
      LOGIN_RATE_LIMIT,
      LOGIN_RATE_WINDOW_MS,
    );

    const limitByIp = rateLimit(
      `login:${ip}`,
      LOGIN_RATE_LIMIT * 4,
      LOGIN_RATE_WINDOW_MS,
    );

    if (!limitByIpAndEmail.success || !limitByIp.success) {
      return NextResponse.json(
        {
          message:
            "Terlalu banyak percobaan login. Silakan coba lagi beberapa saat lagi.",
        },
        {
          status: 429,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
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
     * Selalu panggil bcrypt.compare, baik user ditemukan maupun tidak,
     * supaya waktu respons tidak membocorkan apakah email terdaftar.
     */
    const passwordMatch = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !user.isActive || !passwordMatch) {
      return NextResponse.json(
        { message: "Email atau password salah." },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        },
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
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return NextResponse.json(
      { message: "Terjadi kesalahan pada server." },
      { status: 500 },
    );
  }
}
