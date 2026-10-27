// change-limit.ts
// Batas ganti password / email: hanya boleh sekali dalam 7 hari.

// Jeda minimal antar perubahan: 7 hari (dalam milidetik).
const CHANGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/*
 * Mengembalikan kapan perubahan berikutnya boleh dilakukan,
 * atau null jika sudah boleh sekarang.
 */
export function getNextChangeDate(
  lastChangedAt: Date | null,
): Date | null {
  // Belum pernah mengubah sebelumnya -> boleh sekarang.
  if (!lastChangedAt) {
    return null;
  }

  // Waktu paling cepat perubahan berikutnya.
  const next = new Date(lastChangedAt.getTime() + CHANGE_INTERVAL_MS);

  // Masih di masa tunggu -> kembalikan tanggalnya. Sudah lewat -> null (boleh).
  return next > new Date() ? next : null;
}

// Menyusun pesan error ramah user, lengkap dengan tanggal boleh mengubah lagi (WIB).
export function formatChangeLimitMessage(
  label: string,
  nextDate: Date,
): string {
  // Format tanggal bahasa Indonesia dengan zona waktu Jakarta.
  const formatted = nextDate.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });

  return `${label} hanya dapat diubah seminggu sekali. Coba lagi setelah ${formatted} WIB.`;
}