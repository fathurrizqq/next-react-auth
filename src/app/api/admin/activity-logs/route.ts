// GET /api/admin/activity-logs
// Log aktivitas untuk Super Admin. Paginasi dengan cursor dan hanya log dalam masa retensi.

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { getLogCutoff, purgeOldLogs } from "@/src/lib/audit";
import { jsonResponse, unauthorized } from "@/src/lib/security";

// Jumlah log per halaman bila limit tidak diberikan.
const DEFAULT_LIMIT = 30;
// Batas atas limit per halaman.
const MAX_LIMIT = 100;
// Cursor berupa id log (UUID); formatnya divalidasi sebelum dipakai.
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

// Cek login dan role Super Admin, lalu ambil log terbaru.
export async function GET(request: Request) {
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

    // Pastikan log kedaluwarsa dibersihkan walau belum ada aktivitas baru.
    void purgeOldLogs();

    // Parameter ?limit= dan ?cursor= dari URL.
    const { searchParams } = new URL(request.url);

    // Jumlah log yang diminta.
    const requestedLimit = Number.parseInt(
      searchParams.get("limit") ?? "",
      10,
    );

    // Batasi limit antara 1 dan MAX_LIMIT.
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    // Cursor = id log terakhir dari halaman sebelumnya.
    const cursor = searchParams.get("cursor");

    if (cursor && !UUID_PATTERN.test(cursor)) {
      return jsonResponse({ message: "Cursor tidak valid." }, 400);
    }

    // Ambil 1 data ekstra untuk mengetahui apakah masih ada halaman berikutnya.
    const rows = await prisma.activityLog.findMany({
      // Hanya tampilkan log dalam masa retensi.
      where: {
        createdAt: { gte: getLogCutoff() },
      },
      // Ambil satu data lebih banyak untuk mengetahui apakah masih ada halaman berikutnya.
      take: limit + 1,
      // Mulai setelah log yang menjadi cursor.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      // Terbaru di atas.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        action: true,
        actorEmail: true,
        detail: true,
        ip: true,
        createdAt: true,
        actor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Jika data lebih banyak dari limit, berarti masih ada halaman berikutnya.
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Bentuk data untuk browser. Nama/email pelaku diambil dari user terkait,
    // atau dari email yang tersimpan jika user sudah dihapus.
    const logs = page.map((row) => ({
      id: row.id,
      action: row.action,
      actorName: row.actor?.name ?? null,
      actorEmail: row.actor?.email ?? row.actorEmail,
      detail: row.detail,
      ip: row.ip,
      createdAt: row.createdAt,
    }));

    return jsonResponse({
      logs,
      // Id log terakhir sebagai cursor halaman berikutnya (null jika sudah habis).
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("GET_ACTIVITY_LOGS_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat mengambil log aktivitas." },
      500,
    );
  }
}