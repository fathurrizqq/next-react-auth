import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";

export async function GET() {
  try {
    // =========================================
    // CEK SESSION
    // =========================================

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        {
          status: 401,
        },
      );
    }

    // =========================================
    // CEK SUPER ADMIN
    // =========================================

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki akses.",
        },
        {
          status: 403,
        },
      );
    }

    // =========================================
    // AMBIL SEMUA USER
    // =========================================

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
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

    return NextResponse.json({
      users,
    });
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
      {
        status: 500,
      },
    );
  }
}