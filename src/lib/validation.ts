// validation.ts
// Aturan validasi data (zod) yang dipakai bersama oleh banyak endpoint.

import { z } from "zod";

// Aturan nama: spasi pinggir dibuang, 4 sampai 100 karakter.
export const nameSchema = z
  .string()
  .trim()
  .min(4, "Nama minimal 4 karakter.")
  .max(100, "Nama maksimal 100 karakter.");

// Aturan email: spasi dibuang, diubah ke huruf kecil (agar tidak ada duplikat
// karena beda huruf besar/kecil), format valid, maksimal 254 karakter.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Format email tidak valid.")
  .max(254, "Email terlalu panjang.");

// Kode OTP: tepat 6 digit angka.
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Kode verifikasi harus 6 digit angka.");

/*
 * Satu sumber aturan password, dipakai server (zod) dan UI (daftar centang).
 */
export const PASSWORD_RULES = [
  {
    id: "length",
    label: "Minimal 8 karakter",
    test: (value: string) => value.length >= 8,
  },
  {
    id: "upper",
    label: "Minimal 1 huruf kapital",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "lower",
    label: "Minimal 1 huruf kecil",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "Minimal 1 angka",
    test: (value: string) => /[0-9]/.test(value),
  },
  {
    id: "special",
    label: "Minimal 1 karakter khusus",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

// Aturan password di server. Memakai PASSWORD_RULES yang sama dengan
// checklist di form, supaya aturan client dan server selalu sama.
export const passwordSchema = z
  .string()
  // Batas 72 karakter karena bcrypt hanya membaca 72 byte pertama.
  .max(72, "Password maksimal 72 karakter.")
  .superRefine((value, ctx) => {
    // Tambahkan pesan error untuk setiap syarat yang belum terpenuhi.
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) {
        ctx.addIssue({
          code: "custom",
          message: `Password belum memenuhi syarat: ${rule.label}.`,
        });
      }
    }

    // bcrypt hanya membaca 72 byte pertama.
    if (new TextEncoder().encode(value).length > 72) {
      ctx.addIssue({
        code: "custom",
        message: "Password terlalu panjang.",
      });
    }
  });

// Konfirmasi password: wajib diisi (kecocokannya dicek di passwordsMatch).
export const confirmPasswordSchema = z
  .string()
  .min(1, "Konfirmasi password wajib diisi.")
  .max(72);

// Dipakai di .refine(): password baru harus sama persis dengan konfirmasinya.
export function passwordsMatch(data: {
  newPassword: string;
  confirmPassword: string;
}) {
  return data.newPassword === data.confirmPassword;
}

// Pesan error yang ditempelkan ke field confirmPassword jika tidak cocok.
export const PASSWORD_MISMATCH = {
  message: "Password baru dan konfirmasi password tidak sama.",
  path: ["confirmPassword"],
};