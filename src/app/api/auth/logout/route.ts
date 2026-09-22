import { NextResponse } from "next/server";
import { destroySession } from "@/src/lib/session";

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json({
      message: "Logout berhasil.",
    });
  } catch (error) {
    console.error("LOGOUT_ERROR:", error);

    return NextResponse.json(
      {
        message: "Terjadi kesalahan saat logout.",
      },
      {
        status: 500,
      },
    );
  }
}