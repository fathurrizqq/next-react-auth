import { randomUUID } from "crypto";
import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { getSession } from "@/src/lib/session";
import {
  jsonResponse,
  requireSameOrigin,
  unauthorized,
} from "@/src/lib/security";
import { logActivity } from "@/src/lib/audit";
import { AVATAR_DIR, resolveAvatarPath } from "@/src/lib/avatar";
import { nameSchema } from "@/src/lib/validation";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_REQUEST_SIZE = 3 * 1024 * 1024;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ImageType = {
  mime: string;
  extension: string;
};

/*
 * Deteksi tipe gambar dari magic bytes, bukan dari nama/MIME kiriman user.
 */
function detectImageType(buffer: Buffer): ImageType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: "image/jpeg", extension: "jpg" };
  }

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
    return { mime: "image/png", extension: "png" };
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const session = await getSession();

    if (!session) {
      return unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        avatar: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return unauthorized();
    }

    const contentLength = request.headers.get("content-length");

    if (contentLength && Number(contentLength) > MAX_REQUEST_SIZE) {
      return jsonResponse({ message: "Ukuran request terlalu besar." }, 413);
    }

    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return jsonResponse({ message: "Data profile tidak valid." }, 400);
    }

    const nameValue = formData.get("name");
    const avatarValue = formData.get("avatar");

    if (typeof nameValue !== "string") {
      return jsonResponse({ message: "Data profile tidak valid." }, 400);
    }

    const result = z
      .object({ name: nameSchema })
      .safeParse({ name: nameValue });

    if (!result.success) {
      return jsonResponse(
        {
          message: "Data profile tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    let avatarUrl = user.avatar;
    let newAvatarPath: string | null = null;

    if (avatarValue instanceof File && avatarValue.size > 0) {
      if (avatarValue.size > MAX_AVATAR_SIZE) {
        return jsonResponse({ message: "Ukuran foto maksimal 2 MB." }, 400);
      }

      if (!ALLOWED_MIME_TYPES.includes(avatarValue.type)) {
        return jsonResponse(
          { message: "Format foto harus JPG, PNG, atau WEBP." },
          400,
        );
      }

      const buffer = Buffer.from(await avatarValue.arrayBuffer());
      const detected = detectImageType(buffer);

      if (!detected || detected.mime !== avatarValue.type) {
        return jsonResponse({ message: "File gambar tidak valid." }, 400);
      }

      const fileName = `${user.id}-${randomUUID()}.${detected.extension}`;

      await mkdir(AVATAR_DIR, { recursive: true });

      newAvatarPath = path.join(AVATAR_DIR, fileName);

      await writeFile(newAvatarPath, buffer, { flag: "wx" });

      avatarUrl = `/api/avatars/${fileName}`;
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: result.data.name,
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

      // Database sudah berhasil, baru hapus avatar lama.
      const oldPath = newAvatarPath ? resolveAvatarPath(user.avatar) : null;

      if (oldPath) {
        await unlink(oldPath).catch(() => undefined);
      }

      await logActivity({
        request,
        action: "PROFILE_UPDATED",
        actorId: user.id,
        actorEmail: user.email,
        detail: newAvatarPath ? "Nama dan foto profil" : "Nama",
      });

      return jsonResponse({
        message: "Profile berhasil diperbarui.",
        user: updatedUser,
      });
    } catch (error) {
      // DB gagal setelah file baru tersimpan: hapus file baru.
      if (newAvatarPath) {
        await unlink(newAvatarPath).catch(() => undefined);
      }

      throw error;
    }
  } catch (error) {
    console.error("PROFILE_UPDATE_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat memperbarui profile." },
      500,
    );
  }
}