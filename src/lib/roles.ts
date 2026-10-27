// roles.ts
// Daftar role pengguna dan label tampilannya.

// Role yang ada di sistem (sama dengan enum UserRole di prisma/schema.prisma).
export const USER_ROLES = [
  "USER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

// Tipe TypeScript dari role: "USER" | "ADMIN" | "SUPER_ADMIN".
export type UserRole = (typeof USER_ROLES)[number];

// Mengubah nama role di database menjadi teks yang enak dibaca di layar.
export function getRoleLabel(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";

    case "ADMIN":
      return "Administrator";

    case "USER":
      return "User";

    // Role yang tidak dikenal ditampilkan apa adanya.
    default:
      return role;
  }
}
