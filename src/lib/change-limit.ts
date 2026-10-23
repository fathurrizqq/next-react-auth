const CHANGE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/*
 * Mengembalikan kapan perubahan berikutnya boleh dilakukan,
 * atau null jika sudah boleh sekarang.
 */
export function getNextChangeDate(
  lastChangedAt: Date | null,
): Date | null {
  if (!lastChangedAt) {
    return null;
  }

  const next = new Date(lastChangedAt.getTime() + CHANGE_INTERVAL_MS);

  return next > new Date() ? next : null;
}

export function formatChangeLimitMessage(
  label: string,
  nextDate: Date,
): string {
  const formatted = nextDate.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });

  return `${label} hanya dapat diubah seminggu sekali. Coba lagi setelah ${formatted} WIB.`;
}