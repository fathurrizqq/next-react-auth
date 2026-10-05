import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile, unlink } from "fs/promises";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(4, "Nama minimal 4 karakter."),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email tidak valid."),
});

export async function POST(request: Request) {
  try {
    // =========================================
    // 1. CEK SESSION
    // =========================================

    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          message: "Anda harus login terlebih dahulu.",
        },
        {
          status: 401,
        },
      );
    }

    // =========================================
    // 2. AMBIL USER
    // =========================================

    const user = await prisma.user.findUnique({
      where: {
        id: session.userId,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          message: "User tidak ditemukan.",
        },
        {
          status: 404,
        },
      );
    }

    // =========================================
    // 3. AMBIL FORMDATA
    // =========================================

    const formData = await request.formData();

    const name = String(
      formData.get("name") ?? "",
    );

    const email = String(
      formData.get("email") ?? "",
    );

    const avatar = formData.get("avatar");

    // =========================================
    // 4. VALIDASI PROFILE
    // =========================================

    const result = profileSchema.safeParse({
      name,
      email,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          message: "Data profile tidak valid.",
          errors:
            result.error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    // =========================================
    // 5. CEK EMAIL
    // =========================================

    if (email !== user.email) {
      const existingUser =
        await prisma.user.findUnique({
          where: {
            email,
          },
        });

      if (
        existingUser &&
        existingUser.id !== user.id
      ) {
        return NextResponse.json(
          {
            message:
              "Email tersebut sudah digunakan oleh user lain.",
          },
          {
            status: 409,
          },
        );
      }
    }

    // =========================================
    // 6. PROSES AVATAR
    // =========================================

    let avatarUrl = user.avatar;

    if (avatar instanceof File) {
      // Pastikan file memang gambar
      if (!avatar.type.startsWith("image/")) {
        return NextResponse.json(
          {
            message:
              "File avatar harus berupa gambar.",
          },
          {
            status: 400,
          },
        );
      }

      // Maksimal 2 MB
      if (avatar.size > 2 * 1024 * 1024) {
        return NextResponse.json(
          {
            message:
              "Ukuran foto maksimal 2 MB.",
          },
          {
            status: 400,
          },
        );
      }

      const extension =
        avatar.name.split(".").pop()?.toLowerCase() ||
        "jpg";

      const fileName = `${user.id}-${randomUUID()}.${extension}`;

      const uploadDirectory = path.join(
        process.cwd(),
        "public",
        "uploads",
        "avatars",
      );

      await mkdir(uploadDirectory, {
        recursive: true,
      });

      const filePath = path.join(
        uploadDirectory,
        fileName,
      );

      const bytes = await avatar.arrayBuffer();

      await writeFile(
        filePath,
        Buffer.from(bytes),
      );

      avatarUrl = `/uploads/avatars/${fileName}`;

      // Hapus avatar lama jika berasal dari folder upload kita
      if (
        user.avatar &&
        user.avatar.startsWith(
          "/uploads/avatars/",
        )
      ) {
        const oldFilePath = path.join(
          process.cwd(),
          "public",
          user.avatar,
        );

        try {
          await unlink(oldFilePath);
        } catch {
          // File lama tidak ditemukan.
          // Tidak perlu menggagalkan update profile.
        }
      }
    }

    // =========================================
    // 7. UPDATE USER
    // =========================================

    const updatedUser =
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          name: result.data.name,
          email: result.data.email,
          avatar: avatarUrl,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
        },
      });

    // =========================================
    // 8. RESPONSE
    // =========================================

    return NextResponse.json({
      message: "Profile berhasil diperbarui.",
      user: updatedUser,
    });
  } catch (error) {
    console.error(
      "UPDATE_PROFILE_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat memperbarui profile.",
      },
      {
        status: 500,
      },
    );
  }
}