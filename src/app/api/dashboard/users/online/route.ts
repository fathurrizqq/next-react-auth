import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";

const ONLINE_THRESHOLD_SECONDS = 60;

export async function GET() {
  try {
    const session =
      await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        { status: 401 },
      );
    }

    const onlineSince =
      new Date(
        Date.now() -
          ONLINE_THRESHOLD_SECONDS *
            1000,
      );

    const users =
      await prisma.user.findMany({
        where: {
          isActive: true,
          lastSeen: {
            gte: onlineSince,
          },
        },

        select: {
          id: true,
          name: true,
          role: true,
          avatar: true,
          lastSeen: true,
        },

        orderBy: {
          lastSeen: "desc",
        },
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
      "GET_ONLINE_USERS_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Gagal mengambil user online.",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const session =
      await getSession();

    if (!session) {
      return new NextResponse(
        null,
        { status: 401 },
      );
    }

    /*
     * Tidak perlu mengembalikan
     * data user pada heartbeat.
     */
    await prisma.user.updateMany({
      where: {
        id: session.userId,
        isActive: true,
      },
      data: {
        lastSeen: new Date(),
      },
    });

    return new NextResponse(
      null,
      {
        status: 204,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "ONLINE_HEARTBEAT_ERROR:",
      error,
    );

    return new NextResponse(
      null,
      { status: 500 },
    );
  }
}