import { z } from "zod";
import bcrypt from "bcryptjs";

import { prisma } from "@/src/lib/prisma";
import { issueOtp } from "@/src/lib/otp";
import { sendOtpEmail } from "@/src/lib/mail";
import {
  isAllowedEmailDomain,
  jsonResponse,
  readJson,
  requireSameOrigin,
  tooManyRequests,
} from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";
import {
  emailSchema,
  nameSchema,
  passwordSchema,
} from "@/src/lib/validation";

const schema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const GENERIC_MESSAGE =
  "Jika email dapat digunakan, kode verifikasi telah dikirim ke email tersebut.";

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const ip = getClientIp(request);

    const byIp = rateLimit(
      `register-request:${ip}`,
      20,
      60 * 60 * 1000,
    );

    if (!byIp.success) {
      return tooManyRequests();
    }

    const result = schema.safeParse(await readJson(request));

    if (!result.success) {
      return jsonResponse(
        {
          message: "Data registrasi tidak valid.",
          errors: result.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { name, email, password } = result.data;

    if (!isAllowedEmailDomain(email)) {
      return jsonResponse(
        {
          message: `Gunakan email @${process.env.ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "")}.`,
        },
        400,
      );
    }

    // Hash selalu dihitung agar waktu respons sama,
    // baik email sudah terdaftar maupun belum.
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!existing) {
      const otp = await issueOtp({
        purpose: "REGISTER",
        email,
        payload: { name, passwordHash },
      });

      if (otp.ok) {
        sendOtpEmail(email, "REGISTER", otp.code).catch((error) => {
          console.error("REGISTER_OTP_EMAIL_ERROR:", error);
        });
      }
    }

    // Respons sama untuk email baru maupun yang sudah terdaftar.
    return jsonResponse({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("REGISTER_REQUEST_ERROR:", error);

    return jsonResponse({ message: "Terjadi kesalahan pada server." }, 500);
  }
}