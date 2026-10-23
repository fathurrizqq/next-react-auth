import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import { notifyUser } from "@/src/lib/mail";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
  unauthorized,
} from "@/src/lib/security";
import { logActivity } from "@/src/lib/audit";
import { isUniqueConstraintError } from "@/src/lib/errors";
import { emailSchema, nameSchema } from "@/src/lib/validation";

const updateUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
  isActive: z.boolean(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireSuperAdmin() {
  const session = await getSession();

  if (!session) {
    return { error: unauthorized() };
  }

  if (session.role !== "SUPER_ADMIN") {
    return {
      error: jsonResponse({ message: "Anda tidak memiliki akses." }, 403),
    };
  }

  return { session };
}

async function countActiveSuperAdmins() {
  return prisma.user.count({
    where: { role: "SUPER_ADMIN", isActive: true },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const auth = await requireSuperAdmin();

    if ("error" in auth) {
      return auth.error;
    }

    const { session } = auth;
    const { id } = await context.params;

    const result = updateUserSchema.safeParse(await readJson(request));

    if (!result.success) {
      return jsonResponse(
        {
          message: "Data user tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { name, email, role, isActive } = result.data;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return jsonResponse({ message: "User tidak ditemukan." }, 404);
    }

    // Tidak boleh menurunkan role atau menonaktifkan akun sendiri.
    if (user.id === session.userId && role !== "SUPER_ADMIN") {
      return jsonResponse(
        { message: "Anda tidak dapat menurunkan role akun sendiri." },
        400,
      );
    }

    if (user.id === session.userId && !isActive) {
      return jsonResponse(
        { message: "Anda tidak dapat menonaktifkan akun sendiri." },
        400,
      );
    }

    // Jangan sampai Super Admin aktif terakhir hilang.
    const removesSuperAdmin =
      user.role === "SUPER_ADMIN" &&
      (role !== "SUPER_ADMIN" || !isActive);

    if (removesSuperAdmin && (await countActiveSuperAdmins()) <= 1) {
      return jsonResponse(
        { message: "Minimal harus ada satu Super Admin aktif." },
        400,
      );
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { name, email, role, isActive },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          isActive: true,
        },
      });

      const changes: string[] = [];

      if (user.name !== name) changes.push(`nama "${user.name}" → "${name}"`);
      if (user.email !== email) changes.push(`email ${user.email} → ${email}`);
      if (user.role !== role) changes.push(`role ${user.role} → ${role}`);
      if (user.isActive !== isActive) {
        changes.push(isActive ? "akun diaktifkan" : "akun dinonaktifkan");
      }

      await logActivity({
        request,
        action: "USER_UPDATED",
        actorId: session.userId,
        targetId: user.id,
        detail: `${user.email}: ${changes.join(", ") || "tanpa perubahan"}`,
      });

      // Beri tahu user bahwa akunnya sudah bisa dipakai.
      if (!user.isActive && isActive) {
        notifyUser(
          updatedUser.email,
          "Akun Anda Telah Diaktifkan",
          "Akun Anda telah diaktifkan oleh Super Admin. Sekarang Anda dapat login ke aplikasi.",
          { footer: "" },
        );
      }

      return jsonResponse({
        message: "User berhasil diperbarui.",
        user: updatedUser,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return jsonResponse(
          { message: "Email sudah digunakan user lain." },
          409,
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("UPDATE_ADMIN_USER_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat memperbarui user." },
      500,
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const auth = await requireSuperAdmin();

    if ("error" in auth) {
      return auth.error;
    }

    const { session } = auth;
    const { id } = await context.params;

    if (id === session.userId) {
      return jsonResponse(
        { message: "Anda tidak dapat menghapus akun sendiri." },
        400,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return jsonResponse({ message: "User tidak ditemukan." }, 404);
    }

    if (
      user.role === "SUPER_ADMIN" &&
      (await countActiveSuperAdmins()) <= 1
    ) {
      return jsonResponse(
        { message: "Super Admin terakhir tidak dapat dihapus." },
        400,
      );
    }

    // Session dan OTP ikut terhapus lewat onDelete: Cascade.
    await prisma.user.delete({ where: { id } });

    await logActivity({
      request,
      action: "USER_DELETED",
      actorId: session.userId,
      targetId: user.id,
      detail: `Menghapus user ${user.email}`,
    });

    return jsonResponse({ message: "User berhasil dihapus." });
  } catch (error) {
    console.error("DELETE_ADMIN_USER_ERROR:", error);

    return jsonResponse(
      {
        message:
          "User tidak dapat dihapus. Pastikan user tidak masih digunakan oleh data lain.",
      },
      500,
    );
  }
}