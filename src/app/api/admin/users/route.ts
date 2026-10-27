// GET /api/admin/users
// Daftar semua user (khusus Super Admin).

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { jsonResponse, unauthorized } from "@/src/lib/security";

// Cek login dan role, lalu ambil semua user.
export async function GET() {
  try {
    // Ambil sesi dari cookie. null = belum login atau sesi sudah habis.
    const session = await getSession();

    // Belum login -> 401.
    if (!session) {
      return unauthorized();
    }

    // Bukan Super Admin -> 403.
    if (session.role !== "SUPER_ADMIN") {
      return jsonResponse({ message: "Anda tidak memiliki akses." }, 403);
    }

    // Ambil user tanpa passwordHash, urut berdasarkan role lalu nama.
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        lastSeen: true,
        isActive: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    return jsonResponse({ users });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("ADMIN_LIST_USERS_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat mengambil data user." },
      500,
    );
  }
}