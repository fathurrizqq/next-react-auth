// GET  /api/dashboard/users/online -> daftar user yang sedang online
// POST /api/dashboard/users/online -> "heartbeat": menandai user ini masih aktif
import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";

// User dianggap online jika lastSeen-nya masih dalam 60 detik terakhir.
const ONLINE_THRESHOLD_SECONDS = 60;

// Ambil semua user aktif yang sedang online (bisa dilihat oleh semua user yang sudah login).
export async function GET() {
  try {
    // Ambil sesi dari cookie. null = belum login atau sesi sudah habis.
    const session = await getSession();

    // Belum login -> 401.
    if (!session) {
      return NextResponse.json(
        {
          message: "Anda harus login terlebih dahulu.",
        },
        { status: 401 },
      );
    }

    // Batas waktu: lastSeen harus lebih baru dari ini agar dianggap online.
    const onlineSince = new Date(
      Date.now() - ONLINE_THRESHOLD_SECONDS * 1000,
    );

    // Hanya data yang perlu ditampilkan (tanpa email / password).
    const users = await prisma.user.findMany({
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

      // Yang terakhir aktif ditaruh paling depan.
      orderBy: {
        lastSeen: "desc",
      },
    });

    return NextResponse.json(
      { users },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("GET_ONLINE_USERS_ERROR:", error);

    return NextResponse.json(
      {
        message: "Gagal mengambil user online.",
      },
      { status: 500 },
    );
  }
}

// Heartbeat: dipanggil dashboard tiap 20 detik untuk memperbarui waktu terakhir user terlihat.
export async function POST() {
  try {
    // Ambil sesi dari cookie. null = belum login atau sesi sudah habis.
    const session = await getSession();

    // Belum login -> 401 tanpa isi.
    if (!session) {
      return new NextResponse(null, { status: 401 });
    }

    // Perbarui lastSeen milik user ini saja.
    // Tidak perlu mengembalikan data user pada heartbeat.
    await prisma.user.updateMany({
      where: {
        id: session.userId,
        isActive: true,
      },
      data: {
        lastSeen: new Date(),
      },
    });

    // 204 = berhasil, tanpa isi.
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Catat detail error di log server saja.
    console.error("ONLINE_HEARTBEAT_ERROR:", error);

    return new NextResponse(null, { status: 500 });
  }
}
