// errors.ts
// Helper pengecekan error dari Prisma.

// Apakah error ini pelanggaran kolom unik Prisma (kode P2002)?
// Contoh: email yang sama didaftarkan dua kali.
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}