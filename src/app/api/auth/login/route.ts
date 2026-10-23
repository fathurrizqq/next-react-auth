import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { createSession } from "@/src/lib/session";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
  tooManyRequests,
} from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";
import { logActivity } from "@/src/lib/audit";

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
 * Batas per IP sengaja longgar karena satu kantor biasanya berbagi
 * satu IP. Batas per IP + email yang menahan brute force.
 */
const LOGIN_PER_EMAIL = 5;
const LOGIN_PER_IP = 100;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

/*
 * Hash dummy agar waktu respons "email tidak ada" sama dengan
 * "password salah" (mencegah enumerasi email lewat timing).
 */
let dummyHash: string | null = null;

function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync("dummy-password-timing-safety", 12);
  return dummyHash;
}

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const result = loginSchema.safeParse(await readJson(request));

    if (!result.success) {
      return jsonResponse(
        {
          message: "Data login tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { email, password } = result.data;
    const ip = getClientIp(request);

    const byEmail = rateLimit(
      `login:${ip}:${email}`,
      LOGIN_PER_EMAIL,
      LOGIN_WINDOW_MS,
    );

    const byIp = rateLimit(
      `login:${ip}`,
      LOGIN_PER_IP,
      LOGIN_WINDOW_MS,
    );

    if (!byEmail.success || !byIp.success) {
      return tooManyRequests(
        "Terlalu banyak percobaan login. Silakan coba lagi beberapa menit lagi.",
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

    const passwordMatch = await bcrypt.compare(
      password,
      user?.passwordHash ?? getDummyHash(),
    );

    if (!user || !passwordMatch) {
      if (user) {
        await logActivity({
          request,
          action: "LOGIN_FAILED",
          actorId: user.id,
          actorEmail: user.email,
        });
      }

      return jsonResponse({ message: "Email atau password salah." }, 401);
    }

    /*
     * Pesan ini hanya terlihat oleh orang yang password-nya benar,
     * jadi tidak bisa dipakai untuk menebak email yang terdaftar.
     */
    if (!user.isActive) {
      await logActivity({
        request,
        action: "LOGIN_FAILED",
        actorId: user.id,
        actorEmail: user.email,
        detail: "Akun belum aktif",
      });

      return jsonResponse(
        {
          message:
            "Akun Anda belum aktif. Mohon tunggu aktivasi dari Super Admin.",
        },
        403,
      );
    }

    await createSession(user.id);

    await logActivity({
      request,
      action: "LOGIN",
      actorId: user.id,
      actorEmail: user.email,
    });

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

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}