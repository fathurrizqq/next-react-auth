import { destroySession, getSession } from "@/src/lib/session";
import { jsonResponse, requireSameOrigin } from "@/src/lib/security";
import { logActivity } from "@/src/lib/audit";

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const session = await getSession();

    await destroySession();

    if (session) {
      await logActivity({
        request,
        action: "LOGOUT",
        actorId: session.userId,
      });
    }

    return jsonResponse({ message: "Logout berhasil." });
  } catch (error) {
    console.error("LOGOUT_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan saat logout." }, 500);
  }
}