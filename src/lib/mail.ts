import nodemailer from "nodemailer";

import type { OtpPurposeName } from "@/src/lib/otp";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD belum diset.");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendMail(
  to: string,
  subject: string,
  text: string,
  bodyHtml: string,
) {
  await getTransporter().sendMail({
    from: `"Contractor Management" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html: `<!DOCTYPE html>
<html lang="id">
  <body style="font-family: Arial, sans-serif; line-height: 1.6;">
    ${bodyHtml}
  </body>
</html>`,
  });
}

const OTP_COPY: Record<
  OtpPurposeName,
  { subject: string; intro: string }
> = {
  REGISTER: {
    subject: "Kode Verifikasi Registrasi",
    intro: "Gunakan kode berikut untuk menyelesaikan registrasi akun Anda.",
  },
  RESET_PASSWORD: {
    subject: "Kode Reset Password",
    intro: "Gunakan kode berikut untuk mengatur ulang password Anda.",
  },
  CHANGE_PASSWORD: {
    subject: "Kode Verifikasi Ganti Password",
    intro: "Gunakan kode berikut untuk mengonfirmasi penggantian password.",
  },
  CHANGE_EMAIL: {
    subject: "Kode Verifikasi Email Baru",
    intro: "Gunakan kode berikut untuk memverifikasi email baru Anda.",
  },
};

const OTP_FOOTER =
  "Kode berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun. " +
  "Jika Anda tidak merasa memintanya, abaikan email ini.";

export async function sendOtpEmail(
  to: string,
  purpose: OtpPurposeName,
  code: string,
) {
  const { subject, intro } = OTP_COPY[purpose];

  await sendMail(
    to,
    `${subject} - Contractor Management`,
    `${intro}\n\nKode: ${code}\n\n${OTP_FOOTER}`,
    `<h2>${escapeHtml(subject)}</h2>
    <p>${escapeHtml(intro)}</p>
    <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${escapeHtml(code)}</p>
    <p>${escapeHtml(OTP_FOOTER)}</p>`,
  );
}

const DEFAULT_SECURITY_FOOTER =
  "Jika ini bukan Anda, segera hubungi administrator dan ganti password Anda.";

async function sendNotice(
  to: string,
  subject: string,
  message: string,
  footer: string,
) {
  await sendMail(
    to,
    `${subject} - Contractor Management`,
    footer ? `${message}\n\n${footer}` : message,
    `<h2>${escapeHtml(subject)}</h2>
    <p>${escapeHtml(message)}</p>
    ${footer ? `<p>${escapeHtml(footer)}</p>` : ""}`,
  );
}

type NotifyOptions = {
  /*
   * Kosongkan ("") untuk email yang bukan peringatan keamanan,
   * misalnya pemberitahuan akun diaktifkan.
   */
  footer?: string;
};

/*
 * Notifikasi tidak boleh menggagalkan request utama.
 */
export function notifyUser(
  to: string,
  subject: string,
  message: string,
  options: NotifyOptions = {},
): void {
  sendNotice(
    to,
    subject,
    message,
    options.footer ?? DEFAULT_SECURITY_FOOTER,
  ).catch((error) => {
    console.error("NOTIFICATION_EMAIL_ERROR:", error);
  });
}