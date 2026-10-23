import { z } from "zod";

import { prisma } from "@/src/lib/prisma";
import { issueOtp } from "@/src/lib/otp";
import { sendOtpEmail } from "@/src/lib/mail";
import {
  jsonResponse,
  readJson,
  requireSameOrigin,
} from "@/src/lib/security";
import { getClientIp, rateLimit } from "@/src/lib/rate-limit";
import { emailSchema } from "@/src/lib/validation";

const schema = z.object({ email: emailSchema });

const GENERIC_MESSAGE =
  "Jika email terdaftar, kode reset password telah dikirim.";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const originError = requireSameOrigin(request);

    if (originError) {
      return originError;
    }

    const result = schema.safeParse(await readJson(request));

    if (!result.success) {
      return jsonResponse({ message: "Format email tidak valid." }, 400);
    }

    const { email } = result.data;
    const ip = getClientIp(request);

    const byEmail = rateLimit(`forgot:${ip}:${email}`, 3, WINDOW_MS);
    const byIp = rateLimit(`forgot:${ip}`, 30, WINDOW_MS);

    // Selalu balas generik, jangan bocorkan status rate limit per email.
    if (!byEmail.success || !byIp.success) {
      return jsonResponse({ message: GENERIC_MESSAGE });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });

    if (user && user.isActive) {
      const otp = await issueOtp({
        purpose: "RESET_PASSWORD",
        email: user.email,
        userId: user.id,
      });

      if (otp.ok) {
        // Tidak di-await agar waktu respons sama untuk email
        // terdaftar dan tidak terdaftar.
        sendOtpEmail(user.email, "RESET_PASSWORD", otp.code).catch(
          (error) => {
            console.error("RESET_OTP_EMAIL_ERROR:", error);
          },
        );
      }
    }

    return jsonResponse({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("FORGOT_PASSWORD_ERROR:", error);

    return jsonResponse(
      { message: "Terjadi kesalahan saat memproses permintaan." },
      500,
    );
  }
}