import { NextResponse } from "next/server";

import { z } from "zod";

import { prisma } from "@/src/lib/prisma";

import { getSession } from "@/src/lib/session";

// =========================================
// UPDATE SCHEMA
// =========================================

const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      4,
      "Nama minimal 4 karakter.",
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email tidak valid."),

  role: z.enum([
    "USER",
    "ADMIN",
    "SUPER_ADMIN",
  ]),

  isActive: z.boolean(),
});

// =========================================
// ROUTE CONTEXT
// =========================================

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// =========================================
// UPDATE USER
// =========================================

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    // =========================================
    // CEK SESSION
    // =========================================

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        {
          status: 401,
        },
      );
    }

    // =========================================
    // CEK SUPER ADMIN
    // =========================================

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki akses.",
        },
        {
          status: 403,
        },
      );
    }

    // =========================================
    // AMBIL ID
    // =========================================

    const { id } = await context.params;

    // =========================================
    // AMBIL BODY
    // =========================================

    const body = await request.json();

    // =========================================
    // VALIDASI
    // =========================================

    const result =
      updateUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Data user tidak valid.",

          errors:
            result.error.flatten()
              .fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    const {
      name,
      email,
      role,
      isActive,
    } = result.data;

    // =========================================
    // CARI USER
    // =========================================

    const user =
      await prisma.user.findUnique({
        where: {
          id,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          message:
            "User tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    // =========================================
    // JANGAN IZINKAN SUPER ADMIN
    // MENURUNKAN ROLE DIRINYA SENDIRI
    // =========================================

    if (
      user.id === session.userId &&
      role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        {
          message:
            "Kamu tidak dapat menurunkan role Super Admin milikmu sendiri.",
        },
        {
          status: 400,
        },
      );
    }

    // =========================================
    // JANGAN IZINKAN SUPER ADMIN
    // MENONAKTIFKAN DIRI SENDIRI
    // =========================================

    if (
      user.id === session.userId &&
      !isActive
    ) {
      return NextResponse.json(
        {
          message:
            "Kamu tidak dapat menonaktifkan akun sendiri.",
        },
        {
          status: 400,
        },
      );
    }

    // =========================================
    // CEK EMAIL
    // =========================================

    const emailOwner =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (
      emailOwner &&
      emailOwner.id !== id
    ) {
      return NextResponse.json(
        {
          message:
            "Email tersebut sudah digunakan user lain.",
        },
        {
          status: 409,
        },
      );
    }

    // =========================================
    // UPDATE USER
    // =========================================

    const updatedUser =
      await prisma.user.update({
        where: {
          id,
        },

        data: {
          name,

          email,

          role,

          isActive,
        },

        select: {
          id: true,

          name: true,

          email: true,

          role: true,

          avatar: true,

          isActive: true,

          // lastSeen tidak perlu diubah.
          // lastSeen hanya di-update oleh
          // heartbeat navbar.
        },
      });

    // =========================================
    // RETURN
    // =========================================

    return NextResponse.json({
      message:
        "User berhasil diperbarui.",

      user: updatedUser,
    });
  } catch (error) {
    console.error(
      "UPDATE_ADMIN_USER_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat memperbarui user.",
      },
      {
        status: 500,
      },
    );
  }
}

// =========================================
// DELETE USER
// =========================================

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  try {
    // =========================================
    // CEK SESSION
    // =========================================

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        {
          status: 401,
        },
      );
    }

    // =========================================
    // CEK SUPER ADMIN
    // =========================================

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki akses.",
        },
        {
          status: 403,
        },
      );
    }

    // =========================================
    // AMBIL ID
    // =========================================

    const { id } = await context.params;

    // =========================================
    // TIDAK BOLEH HAPUS DIRI SENDIRI
    // =========================================

    if (id === session.userId) {
      return NextResponse.json(
        {
          message:
            "Kamu tidak dapat menghapus akun sendiri.",
        },
        {
          status: 400,
        },
      );
    }

    // =========================================
    // CEK USER
    // =========================================

    const user =
      await prisma.user.findUnique({
        where: {
          id,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          message:
            "User tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    // =========================================
    // DELETE
    // =========================================

    await prisma.user.delete({
      where: {
        id,
      },
    });

    // =========================================
    // RETURN
    // =========================================

    return NextResponse.json({
      message:
        "User berhasil dihapus.",
    });
  } catch (error) {
    console.error(
      "DELETE_ADMIN_USER_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat menghapus user.",
      },
      {
        status: 500,
      },
    );
  }
}