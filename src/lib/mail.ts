// mail.ts
// Pengiriman email lewat Gmail (nodemailer): kode OTP dan pemberitahuan keamanan.

import nodemailer from "nodemailer";

import type { OtpPurposeName } from "@/src/lib/otp";

// Koneksi SMTP dibuat sekali (lazy), lalu dipakai ulang.
let transporter: nodemailer.Transporter | null = null;

// Buat / ambil koneksi Gmail. Dibuat saat pertama kali dipakai (bukan saat import)
// supaya `next build` tidak gagal jika env belum diisi.
function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  // Wajib ada akun Gmail dan App Password di .env.
  if (!user || !pass) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD belum diset.");
  }

  // Login ke Gmail memakai App Password (bukan password akun Google).
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return transporter;
}

// Mengubah karakter berbahaya (< > & tanda kutip) menjadi entitas HTML,
// agar teks dari user tidak bisa menyisipkan HTML/script ke dalam email.
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Fungsi dasar pengirim email: membungkus isi dalam template HTML sederhana.
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
    // Versi teks biasa untuk email client yang tidak menampilkan HTML.
    text,
    html: `<!DOCTYPE html>
<html lang="id">
  <body style="font-family: Arial, sans-serif; line-height: 1.6;">
    ${bodyHtml}
  </body>
</html>`,
  });
}

// Judul dan kalimat pembuka email untuk tiap jenis OTP.
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

// Penutup email OTP: masa berlaku dan peringatan jangan dibagikan.
const OTP_FOOTER =
  "Kode berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun. " +
  "Jika Anda tidak merasa memintanya, abaikan email ini.";

// Kirim kode OTP ke email. Dipakai oleh registrasi, lupa password,
// ganti password, dan ganti email.
export async function sendOtpEmail(
  to: string,
  purpose: OtpPurposeName,
  code: string,
) {
  // Ambil teks sesuai tujuan OTP.
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

// Penutup bawaan untuk email pemberitahuan keamanan.
const DEFAULT_SECURITY_FOOTER =
  "Jika ini bukan Anda, segera hubungi administrator dan ganti password Anda.";

// Kirim email pemberitahuan biasa. footer kosong = tanpa kalimat penutup.
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
  // Tanpa await: email dikirim di latar belakang, kegagalannya hanya dicatat.
  sendNotice(
    to,
    subject,
    message,
    options.footer ?? DEFAULT_SECURITY_FOOTER,
  ).catch((error) => {
    console.error("NOTIFICATION_EMAIL_ERROR:", error);
  });
}