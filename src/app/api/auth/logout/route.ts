// POST /api/auth/logout
// Mengakhiri sesi login.

import { destroySession, getSession } from "@/src/lib/session";
import { jsonResponse, requireSameOrigin } from "@/src/lib/security";
import { logActivity } from "@/src/lib/audit";

// Hapus sesi dari database dan cookie, lalu catat ke log.
export async function POST(request: Request) {
  try {
    // Proteksi CSRF: tolak request yang tidak berasal dari website ini.
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    // Ambil sesi dari cookie. null = belum login atau sesi sudah habis.
    const session = await getSession();

    // Hapus sesi di database dan cookie (tetap dijalankan walau session null).
    await destroySession();

    // Catat logout hanya jika memang ada sesi aktif.
    if (session) {
      // Catat ke log aktivitas (tampil di halaman User Management).
      await logActivity({
        request,
        action: "LOGOUT",
        actorId: session.userId,
      });
    }

    return jsonResponse({ message: "Logout berhasil." });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("LOGOUT_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan saat logout." }, 500);
  }
}