import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.AUTH_SECRET;

if (!secretKey) {
  throw new Error("AUTH_SECRET belum diset");
}

const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt()
    .setExpirationTime("7d") /* Bisa diatur sesuai kebutuhan jika ingin 1 jam ("1h") maka maxAge: 60 * 60 */
    .sign(encodedKey);

  const cookieStore = await cookies();

  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();

  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, encodedKey);

    if (
      typeof payload.userId !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role as SessionPayload["role"],
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();

  cookieStore.delete("session");
}