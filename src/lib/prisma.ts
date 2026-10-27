// prisma.ts
// Satu koneksi Prisma ke PostgreSQL yang dipakai seluruh aplikasi.

// Memuat file .env (DATABASE_URL, dll.).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/src/generated/prisma/client";

// Alamat database dari .env.
const connectionString = process.env.DATABASE_URL;

// Hentikan lebih awal dengan pesan yang jelas bila belum diisi.
if (!connectionString) {
  throw new Error("DATABASE_URL belum diset.");
}

// Adapter PostgreSQL untuk Prisma 7.
const adapter = new PrismaPg({
  connectionString,
});

// Instance disimpan di globalThis agar saat hot-reload (development)
// tidak terus-menerus membuat koneksi baru.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Instance yang diekspor: pakai yang sudah ada, kalau belum ada buat baru.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

// Di development, simpan instance ke global (lihat catatan di atas).
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}