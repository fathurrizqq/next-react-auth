// audit.ts
// Pencatatan log aktivitas (siapa melakukan apa) + penghapusan otomatis log lama.

import { prisma } from "@/src/lib/prisma";
import { getClientIp } from "@/src/lib/rate-limit";

// Jenis aktivitas yang dicatat. Label tampilannya ada di ACTION_STYLES
// (src/app/dashboard/users/page.tsx).
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

// Kapan pembersihan terakhir berjalan (per proses server).
let lastPurgeAt = 0;

// Batas waktu: log yang lebih tua dari ini dianggap kedaluwarsa.
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

  // Baru dibersihkan kurang dari 1 jam lalu -> lewati.
  if (now - lastPurgeAt < PURGE_INTERVAL_MS) {
    return;
  }

  // Tandai waktu pembersihan sekarang.
  lastPurgeAt = now;

  try {
    // Hapus semua log yang melewati masa retensi.
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

// Data yang diberikan saat mencatat satu aktivitas.
type LogActivityInput = {
  request: Request;
  action: ActivityAction;
  // Siapa yang melakukan aksi (null jika tidak dikenal).
  actorId?: string | null;
  actorEmail?: string | null;
  // User yang dikenai aksi (untuk aksi admin).
  targetId?: string | null;
  // Keterangan tambahan yang tampil di log.
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
    // Simpan satu baris log. IP diambil dari header request.
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