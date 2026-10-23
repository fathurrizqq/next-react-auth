import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { getLogCutoff, purgeOldLogs } from "@/src/lib/audit";
import { jsonResponse, unauthorized } from "@/src/lib/security";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return unauthorized();
    }

    if (session.role !== "SUPER_ADMIN") {
      return jsonResponse({ message: "Anda tidak memiliki akses." }, 403);
    }

    // Pastikan log kedaluwarsa dibersihkan walau belum ada aktivitas baru.
    void purgeOldLogs();

    const { searchParams } = new URL(request.url);

    const requestedLimit = Number.parseInt(
      searchParams.get("limit") ?? "",
      10,
    );

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

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
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

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
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    console.error("GET_ACTIVITY_LOGS_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat mengambil log aktivitas." },
      500,
    );
  }
}