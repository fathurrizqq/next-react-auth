import nodemailer from "nodemailer";

const gmailUser =
  process.env.GMAIL_USER;

const gmailAppPassword =
  process.env.GMAIL_APP_PASSWORD;

if (!gmailUser) {
  throw new Error(
    "GMAIL_USER belum diset.",
  );
}

if (!gmailAppPassword) {
  throw new Error(
    "GMAIL_APP_PASSWORD belum diset.",
  );
}

const transporter =
  nodemailer.createTransport({
    service: "gmail",

    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
) {
  const safeUrl =
    escapeHtml(resetUrl);

  await transporter.sendMail({
    from: `"Contractor Management" <${gmailUser}>`,

    to: email,

    subject:
      "Reset Password - Contractor Management",

    text:
      `Kami menerima permintaan reset password.\n\n` +
      `Gunakan link berikut untuk membuat password baru:\n` +
      `${resetUrl}\n\n` +
      `Link berlaku selama 30 menit.\n\n` +
      `Jika kamu tidak meminta reset password, abaikan email ini.`,

    html: `
      <!DOCTYPE html>
      <html lang="id">
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Reset Password</h2>

          <p>
            Kami menerima permintaan untuk
            mengatur ulang password akun kamu.
          </p>

          <p>
            Link reset password berlaku selama
            <strong>30 menit</strong>.
          </p>

          <p>
            <a
              href="${safeUrl}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Reset Password
            </a>
          </p>

          <p>
            Jika kamu tidak meminta reset password,
            abaikan email ini.
          </p>
        </body>
      </html>
    `,
  });
}