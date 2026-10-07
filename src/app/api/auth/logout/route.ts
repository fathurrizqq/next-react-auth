import { NextResponse } from "next/server";

import { destroySession } from "@/src/lib/session";
import { requireSameOrigin } from "@/src/lib/security";

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    await destroySession();

    return NextResponse.json(
      {
        message: "Logout berhasil.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("LOGOUT_ERROR:", error);

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat logout.",
      },
      { status: 500 },
    );
  }
}