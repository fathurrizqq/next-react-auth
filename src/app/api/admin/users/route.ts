import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { jsonResponse, unauthorized } from "@/src/lib/security";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return unauthorized();
    }

    if (session.role !== "SUPER_ADMIN") {
      return jsonResponse({ message: "Anda tidak memiliki akses." }, 403);
    }

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
    console.error("ADMIN_LIST_USERS_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat mengambil data user." },
      500,
    );
  }
}