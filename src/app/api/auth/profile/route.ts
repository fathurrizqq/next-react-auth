import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import {
  mkdir,
  writeFile,
  unlink,
} from "fs/promises";
import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import {
  requireSameOrigin,
} from "@/src/lib/security";

const MAX_AVATAR_SIZE =
  2 * 1024 * 1024;

const profileSchema = z.object({
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
});

type ImageType = {
  mime: string;
  extension: string;
};

function detectImageType(
  buffer: Buffer,
): ImageType | null {
  /*
   * JPEG
   */
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      mime: "image/jpeg",
      extension: "jpg",
    };
  }

  /*
   * PNG
   */
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return {
      mime: "image/png",
      extension: "png",
    };
  }

  /*
   * WEBP
   */
  if (
    buffer.length >= 12 &&
    buffer.toString(
      "ascii",
      0,
      4,
    ) === "RIFF" &&
    buffer.toString(
      "ascii",
      8,
      12,
    ) === "WEBP"
  ) {
    return {
      mime: "image/webp",
      extension: "webp",
    };
  }

  return null;
}

export async function POST(
  request: Request,
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

    const user =
      await prisma.user.findUnique({
        where: {
          id: session.userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          isActive: true,
          role: true,
        },
      });

    if (!user || !user.isActive) {
      return NextResponse.json(
        {
          message:
            "Akun tidak dapat digunakan.",
        },
        { status: 401 },
      );
    }

    const contentLength =
      request.headers.get(
        "content-length",
      );

    if (
      contentLength &&
      Number(contentLength) >
        3 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          message:
            "Ukuran request terlalu besar.",
        },
        { status: 413 },
      );
    }

    const formData =
      await request.formData();

    const nameValue =
      formData.get("name");

    const emailValue =
      formData.get("email");

    const avatarValue =
      formData.get("avatar");

    if (
      typeof nameValue !== "string" ||
      typeof emailValue !== "string"
    ) {
      return NextResponse.json(
        {
          message:
            "Data profile tidak valid.",
        },
        { status: 400 },
      );
    }

    const result =
      profileSchema.safeParse({
        name: nameValue,
        email: emailValue,
      });

    if (!result.success) {
      return NextResponse.json(
        {
          message:
            "Data profile tidak valid.",
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
    } = result.data;

    let avatarUrl =
      user.avatar;

    let newAvatarPath:
      | string
      | null = null;

    if (
      avatarValue instanceof File &&
      avatarValue.size > 0
    ) {
      if (
        avatarValue.size >
        MAX_AVATAR_SIZE
      ) {
        return NextResponse.json(
          {
            message:
              "Ukuran foto maksimal 2 MB.",
          },
          { status: 400 },
        );
      }

      const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (
        !allowedMimeTypes.includes(
          avatarValue.type,
        )
      ) {
        return NextResponse.json(
          {
            message:
              "Format foto harus JPG, PNG, atau WEBP.",
          },
          { status: 400 },
        );
      }

      const bytes =
        await avatarValue.arrayBuffer();

      const buffer =
        Buffer.from(bytes);

      const detectedType =
        detectImageType(buffer);

      if (
        !detectedType ||
        detectedType.mime !==
          avatarValue.type
      ) {
        return NextResponse.json(
          {
            message:
              "File gambar tidak valid.",
          },
          { status: 400 },
        );
      }

      const fileName =
        `${user.id}-${randomUUID()}.` +
        detectedType.extension;

      const uploadDirectory =
        path.join(
          process.cwd(),
          "public",
          "uploads",
          "avatars",
        );

      await mkdir(
        uploadDirectory,
        {
          recursive: true,
        },
      );

      const filePath =
        path.join(
          uploadDirectory,
          fileName,
        );

      await writeFile(
        filePath,
        buffer,
        {
          flag: "wx",
        },
      );

      newAvatarPath =
        filePath;

      avatarUrl =
        `/uploads/avatars/${fileName}`;
    }

    try {
      const updatedUser =
        await prisma.user.update({
          where: {
            id: user.id,
          },
          data: {
            name,
            email,
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

      /*
       * Database sudah berhasil.
       * Baru hapus avatar lama.
       */
      if (
        newAvatarPath &&
        user.avatar?.startsWith(
          "/uploads/avatars/",
        )
      ) {
        const oldFilePath =
          path.join(
            process.cwd(),
            "public",
            user.avatar,
          );

        try {
          await unlink(
            oldFilePath,
          );
        } catch {
          /*
           * Avatar lama tidak ditemukan
           * tidak menggagalkan update profile.
           */
        }
      }

      return NextResponse.json(
        {
          message:
            "Profile berhasil diperbarui.",
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
      /*
       * Kalau DB gagal setelah file baru
       * berhasil dibuat, hapus file baru.
       */
      if (newAvatarPath) {
        try {
          await unlink(
            newAvatarPath,
          );
        } catch {
          // abaikan cleanup error
        }
      }

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
      "PROFILE_UPDATE_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Terjadi kesalahan saat memperbarui profile.",
      },
      { status: 500 },
    );
  }
}