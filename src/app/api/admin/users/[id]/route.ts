import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import {
  requireSameOrigin,
} from "@/src/lib/security";

const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      4,
      "Nama minimal 4 karakter.",
    )
    .max(
      100,
      "Nama maksimal 100 karakter.",
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email tidak valid.")
    .max(254),

  role: z.enum([
    "USER",
    "ADMIN",
    "SUPER_ADMIN",
  ]),

  isActive: z.boolean(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const originError =
      requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const session =
      await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        { status: 401 },
      );
    }

    if (
      session.role !==
      "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki akses.",
        },
        { status: 403 },
      );
    }

    const { id } =
      await context.params;

    const body =
      await request.json();

    const result =
      updateUserSchema.safeParse(
        body,
      );

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Data user tidak valid.",
          errors:
            result.error.flatten()
              .fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      name,
      email,
      role,
      isActive,
    } = result.data;

    const user =
      await prisma.user.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          message:
            "User tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    /*
     * Tidak boleh menurunkan role sendiri.
     */
    if (
      user.id === session.userId &&
      role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        {
          message:
            "Anda tidak dapat menurunkan role akun sendiri.",
        },
        { status: 400 },
      );
    }

    /*
     * Tidak boleh menonaktifkan diri sendiri.
     */
    if (
      user.id === session.userId &&
      !isActive
    ) {
      return NextResponse.json(
        {
          message:
            "Anda tidak dapat menonaktifkan akun sendiri.",
        },
        { status: 400 },
      );
    }

    /*
     * Pastikan tidak menghilangkan
     * Super Admin terakhir.
     */
    const removesSuperAdmin =
      user.role === "SUPER_ADMIN" &&
      (role !== "SUPER_ADMIN" ||
        !isActive);

    if (removesSuperAdmin) {
      const activeSuperAdminCount =
        await prisma.user.count({
          where: {
            role: "SUPER_ADMIN",
            isActive: true,
          },
        });

      if (
        activeSuperAdminCount <= 1
      ) {
        return NextResponse.json(
          {
            message:
              "Minimal harus ada satu Super Admin aktif.",
          },
          { status: 400 },
        );
      }
    }

    try {
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
          },
        });

      return NextResponse.json(
        {
          message:
            "User berhasil diperbarui.",
          user: updatedUser,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            message:
              "Email sudah digunakan user lain.",
          },
          { status: 409 },
        );
      }

      throw error;
    }
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
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  try {
    const originError =
      requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const session =
      await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Anda harus login terlebih dahulu.",
        },
        { status: 401 },
      );
    }

    if (
      session.role !==
      "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki akses.",
        },
        { status: 403 },
      );
    }

    const { id } =
      await context.params;

    if (id === session.userId) {
      return NextResponse.json(
        {
          message:
            "Anda tidak dapat menghapus akun sendiri.",
        },
        { status: 400 },
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          message:
            "User tidak ditemukan.",
        },
        { status: 404 },
      );
    }

    if (
      user.role === "SUPER_ADMIN"
    ) {
      const activeSuperAdminCount =
        await prisma.user.count({
          where: {
            role: "SUPER_ADMIN",
            isActive: true,
          },
        });

      if (
        activeSuperAdminCount <= 1
      ) {
        return NextResponse.json(
          {
            message:
              "Super Admin terakhir tidak dapat dihapus.",
          },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: id,
        },
      }),

      prisma.user.delete({
        where: {
          id,
        },
      }),
    ]);

    return NextResponse.json(
      {
        message:
          "User berhasil dihapus.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "DELETE_ADMIN_USER_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "User tidak dapat dihapus. Pastikan user tidak masih digunakan oleh data lain.",
      },
      { status: 500 },
    );
  }
}