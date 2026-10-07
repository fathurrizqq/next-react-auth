export const USER_ROLES = [
  "USER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_MANAGEMENT_ROLES = [
  "USER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";

    case "ADMIN":
      return "Administrator";

    case "USER":
      return "User";

    default:
      return role;
  }
}