import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { verifyOtp } from "@/src/lib/otp";
import { notifyUser } from "@/src/lib/mail";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
  tooManyRequests,
} from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";
import { logActivity } from "@/src/lib/audit";
import { isUniqueConstraintError } from "@/src/lib/errors";
import { emailSchema, otpCodeSchema } from "@/src/lib/validation";

const schema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});

const INVALID_CODE = "Kode tidak valid atau sudah kedaluwarsa.";

const SUCCESS_MESSAGE =
  "Registrasi berhasil. Akun Anda menunggu aktivasi oleh Super Admin. " +
  "Anda dapat login setelah akun diaktifkan.";

/*
 * Beri tahu semua Super Admin aktif bahwa ada registrasi baru.
 * Gagal kirim email tidak boleh menggagalkan registrasi.
 */
async function notifySuperAdmins(name: string, email: string) {
  try {
    const superAdmins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN", isActive: true },
      select: { email: true },
    });

    for (const admin of superAdmins) {
      notifyUser(
        admin.email,
        "Registrasi Baru Menunggu Aktivasi",
        `${name} (${email}) baru mendaftar dan menunggu aktivasi. ` +
          "Buka halaman User Management untuk mengaktifkan atau menolak akun ini.",
        { footer: "" },
      );
    }
  } catch (error) {
    console.error("NOTIFY_SUPER_ADMINS_ERROR:", error);
  }
}

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const limit = rateLimit(
      `register-verify:${getClientIp(request)}`,
      30,
      10 * 60 * 1000,
    );

    if (!limit.success) {
      return tooManyRequests();
    }

    const result = schema.safeParse(await readJson(request));

    if (!result.success) {
      return jsonResponse(
        {
          message: "Data verifikasi tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { email, code } = result.data;

    const verified = await verifyOtp({
      purpose: "REGISTER",
      email,
      code,
    });

    const payload = verified?.payload as {
      name?: unknown;
      passwordHash?: unknown;
    } | null;

    if (
      !verified ||
      !payload ||
      typeof payload.name !== "string" ||
      typeof payload.passwordHash !== "string"
    ) {
      return jsonResponse({ message: INVALID_CODE }, 400);
    }

    try {
      const user = await prisma.user.create({
        data: {
          name: payload.name,
          email,
          passwordHash: payload.passwordHash,
          role: "USER",

          /*
           * Akun baru nonaktif sampai Super Admin mengaktifkannya.
           */
          isActive: false,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      await logActivity({
        request,
        action: "REGISTER",
        actorId: user.id,
        actorEmail: user.email,
        detail: "Menunggu aktivasi Super Admin",
      });

      await notifySuperAdmins(user.name, user.email);

      return jsonResponse(
        { message: SUCCESS_MESSAGE, user },
        201,
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return jsonResponse({ message: "Email sudah terdaftar." }, 409);
      }

      throw error;
    }
  } catch (error) {
    console.error("REGISTER_VERIFY_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}