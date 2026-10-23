import { prisma } from "@/src/lib/prisma";
import { getClientIp } from "@/src/lib/rate-limit";

export type ActivityAction =
  | "REGISTER"
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET"
  | "EMAIL_CHANGED"
  | "PROFILE_UPDATED"
  | "USER_UPDATED"
  | "USER_DELETED";

/*
 * Log aktivitas disimpan selama 7 hari, lalu dihapus otomatis.
 * Ubah angka ini jika ingin retensi yang berbeda.
 */
export const LOG_RETENTION_DAYS = 7;

// Pembersihan dijalankan paling sering sekali per jam per proses server.
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

let lastPurgeAt = 0;

export function getLogCutoff(): Date {
  return new Date(
    Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}

/*
 * Hapus log yang lebih tua dari masa retensi.
 * Aman dipanggil berulang: hanya benar-benar berjalan sekali per jam.
 */
export async function purgeOldLogs(): Promise<void> {
  const now = Date.now();

  if (now - lastPurgeAt < PURGE_INTERVAL_MS) {
    return;
  }

  lastPurgeAt = now;

  try {
    await prisma.activityLog.deleteMany({
      where: {
        createdAt: { lt: getLogCutoff() },
      },
    });
  } catch (error) {
    console.error("PURGE_ACTIVITY_LOGS_ERROR:", error);

    // Izinkan percobaan ulang pada pemanggilan berikutnya.
    lastPurgeAt = 0;
  }
}

type LogActivityInput = {
  request: Request;
  action: ActivityAction;
  actorId?: string | null;
  actorEmail?: string | null;
  targetId?: string | null;
  detail?: string | null;
};

/*
 * Log aktivitas tidak boleh menggagalkan request utama.
 */
export async function logActivity({
  request,
  action,
  actorId,
  actorEmail,
  targetId,
  detail,
}: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        actorId: actorId ?? null,
        actorEmail: actorEmail ?? null,
        targetId: targetId ?? null,
        detail: detail ?? null,
        ip: getClientIp(request),
      },
    });
  } catch (error) {
    console.error("ACTIVITY_LOG_ERROR:", error);
  }

  // Tidak di-await agar tidak memperlambat request.
  void purgeOldLogs();
}