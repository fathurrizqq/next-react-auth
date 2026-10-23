import { z } from "zod";

export const nameSchema = z
  .string()
  .trim()
  .min(4, "Nama minimal 4 karakter.")
  .max(100, "Nama maksimal 100 karakter.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Format email tidak valid.")
  .max(254, "Email terlalu panjang.");

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

export const passwordSchema = z
  .string()
  .max(72, "Password maksimal 72 karakter.")
  .superRefine((value, ctx) => {
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

export const confirmPasswordSchema = z
  .string()
  .min(1, "Konfirmasi password wajib diisi.")
  .max(72);

export function passwordsMatch(data: {
  newPassword: string;
  confirmPassword: string;
}) {
  return data.newPassword === data.confirmPassword;
}

export const PASSWORD_MISMATCH = {
  message: "Password baru dan konfirmasi password tidak sama.",
  path: ["confirmPassword"],
};