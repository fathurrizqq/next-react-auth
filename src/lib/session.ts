import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { prisma } from "@/src/lib/prisma";
import {
  isUserRole,
  type UserRole,
} from "@/src/lib/roles";

const secret = process.env.AUTH_SECRET;

if (!secret) {
  throw new Error("AUTH_SECRET belum diset.");
}

if (secret.length < 32) {
  throw new Error(
    "AUTH_SECRET harus memiliki minimal 32 karakter.",
  );
}

const encodedKey = new TextEncoder().encode(secret);

const SESSION_MAX_AGE = 60 * 60 * 24;

const JWT_ISSUER = "contractor-management";
const JWT_AUDIENCE = "contractor-management";

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-session"
    : "session";

export type SessionPayload = {
  userId: string;
  role: UserRole;
};

export async function createSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new Error("User tidak valid atau tidak aktif.");
  }

  const role = String(user.role);

  if (!isUserRole(role)) {
    throw new Error("Role user tidak valid.");
  }

  const token = await new SignJWT({
    userId: user.id,
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime("1d")
    .sign(encodedKey);

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      encodedKey,
      {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    );

    if (typeof payload.userId !== "string") {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const role = String(user.role);

    if (!isUserRole(role)) {
      return null;
    }

    return {
      userId: user.id,
      role,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}