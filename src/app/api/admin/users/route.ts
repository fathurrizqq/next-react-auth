import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        { status: 401 },
      );
    }

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki akses.",
        },
        { status: 403 },
      );
    }

    const users =
      await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          lastSeen: true,
          isActive: true,
        },
        orderBy: [
          {
            role: "asc",
          },
          {
            name: "asc",
          },
        ],
      });

    return NextResponse.json(
      { users },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "GET_ADMIN_USERS_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat mengambil data user.",
      },
      { status: 500 },
    );
  }
}