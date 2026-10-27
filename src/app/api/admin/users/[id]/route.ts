// PATCH /api/admin/users/[id]  -> ubah user
// DELETE /api/admin/users/[id] -> hapus user
// Keduanya khusus Super Admin.

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

// Aturan data ubah user: nama, email, role, dan status aktif.
const updateUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
  isActive: z.boolean(),
});

// Next.js memberikan params sebagai Promise.
type RouteContext = {
  params: Promise<{ id: string }>;
};

// Pastikan pemanggil sudah login dan berrole SUPER_ADMIN.
// Mengembalikan { error } (respons siap kirim) atau { session }.
async function requireSuperAdmin() {
  // Ambil sesi dari cookie. null = belum login atau sesi sudah habis.
  const session = await getSession();

  // Belum login -> 401.
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

// Hitung Super Admin yang aktif (agar yang terakhir tidak sampai hilang).
async function countActiveSuperAdmins() {
  return prisma.user.count({
    where: { role: "SUPER_ADMIN", isActive: true },
  });
}

// Ubah nama, email, role, dan status aktif user. Ada beberapa pengaman untuk akun sendiri
// dan Super Admin terakhir.
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // Proteksi CSRF: tolak request yang tidak berasal dari website ini.
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    // Cek hak akses Super Admin.
    const auth = await requireSuperAdmin();

    // Tidak berhak -> kembalikan respons error-nya.
    if ("error" in auth) {
      return auth.error;
    }

    // Sesi Super Admin yang sedang login.
    const { session } = auth;
    // Ambil id user dari URL (/api/admin/users/[id]).
    const { id } = await context.params;

    // Validasi isi request dengan zod (tidak melempar error jika salah).
    const result = updateUserSchema.safeParse(await readJson(request));

    // Data tidak sesuai aturan -> 400 beserta pesan error per field.
    if (!result.success) {
      return jsonResponse(
        {
          message: "Data user tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    // Data baru yang sudah bersih dan tervalidasi.
    const { name, email, role, isActive } = result.data;

    // Ambil data user dari database.
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

    // User tidak ditemukan -> 404.
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

    // Perubahan ini mengurangi Super Admin aktif, padahal tinggal satu -> tolak.
    if (removesSuperAdmin && (await countActiveSuperAdmins()) <= 1) {
      return jsonResponse(
        { message: "Minimal harus ada satu Super Admin aktif." },
        400,
      );
    }

    try {
      // Simpan perubahan ke database.
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

      // Susun ringkasan perubahan untuk ditulis di log.
      const changes: string[] = [];

      if (user.name !== name) changes.push(`nama "${user.name}" → "${name}"`);
      if (user.email !== email) changes.push(`email ${user.email} → ${email}`);
      if (user.role !== role) changes.push(`role ${user.role} → ${role}`);
      if (user.isActive !== isActive) {
        changes.push(isActive ? "akun diaktifkan" : "akun dinonaktifkan");
      }

      // Catat ke log aktivitas (tampil di halaman User Management).
      await logActivity({
        request,
        action: "USER_UPDATED",
        actorId: session.userId,
        targetId: user.id,
        detail: `${user.email}: ${changes.join(", ") || "tanpa perubahan"}`,
      });

      // Beri tahu user bahwa akunnya sudah bisa dipakai.
      if (!user.isActive && isActive) {
        // Kirim email pemberitahuan di latar belakang (kegagalan tidak membatalkan proses).
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
      // Email baru sudah dipakai user lain -> 409.
      if (isUniqueConstraintError(error)) {
        return jsonResponse(
          { message: "Email sudah digunakan user lain." },
          409,
        );
      }

      // Error lain dilempar ke catch terluar -> 500.
      throw error;
    }
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
    console.error("UPDATE_ADMIN_USER_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat memperbarui user." },
      500,
    );
  }
}

// Hapus user. Tidak boleh menghapus akun sendiri atau Super Admin terakhir.
export async function DELETE(request: Request, context: RouteContext) {
  try {
    // Proteksi CSRF: tolak request yang tidak berasal dari website ini.
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    // Cek hak akses Super Admin.
    const auth = await requireSuperAdmin();

    // Tidak berhak -> kembalikan respons error-nya.
    if ("error" in auth) {
      return auth.error;
    }

    // Sesi Super Admin yang sedang login.
    const { session } = auth;
    // Ambil id user dari URL (/api/admin/users/[id]).
    const { id } = await context.params;

    // Tidak boleh menghapus akun sendiri.
    if (id === session.userId) {
      return jsonResponse(
        { message: "Anda tidak dapat menghapus akun sendiri." },
        400,
      );
    }

    // Ambil data user dari database.
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });

    // User tidak ditemukan -> 404.
    if (!user) {
      return jsonResponse({ message: "User tidak ditemukan." }, 404);
    }

    // Super Admin aktif terakhir tidak boleh dihapus.
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

    // Catat ke log aktivitas (tampil di halaman User Management).
    await logActivity({
      request,
      action: "USER_DELETED",
      actorId: session.userId,
      targetId: user.id,
      detail: `Menghapus user ${user.email}`,
    });

    return jsonResponse({ message: "User berhasil dihapus." });
  } catch (error) {
    // Catat detail error di log server saja; user hanya menerima pesan umum.
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