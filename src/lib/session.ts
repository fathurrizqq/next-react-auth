import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "crypto";

import { prisma } from "@/src/lib/prisma";
import type { UserRole } from "@/src/lib/roles";

/*
 * Session disimpan di database. Cookie hanya berisi token acak;
 * database hanya menyimpan hash-nya. Masa berlaku absolut 3 jam.
 */
const SECURE = process.env.NODE_ENV === "production";
const COOKIE_NAME = SECURE ? "__Host-sid" : "sid";

export const SESSION_DURATION_MS = 3 * 60 * 60 * 1000;

export type Session = {
  sessionId: string;
  userId: string;
  role: UserRole;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const userAgent =
    (await headers()).get("user-agent")?.slice(0, 255) ?? null;

  await prisma.$transaction([
    // Bersihkan session kedaluwarsa sambil jalan.
    prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    }),
    prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        userAgent,
        expiresAt,
      },
    }),
  ]);

  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const record = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (
    !record ||
    record.expiresAt <= new Date() ||
    !record.user.isActive
  ) {
    return null;
  }

  return {
    sessionId: record.id,
    userId: record.user.id,
    role: record.user.role,
  };
});

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  store.delete(COOKIE_NAME);
}