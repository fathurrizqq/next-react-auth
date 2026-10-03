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

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
) {
  await transporter.sendMail({
    from: `"Auth System" <${gmailUser}>`,
    to: email,
    subject: "Reset Password",

    text: `
Anda menerima email ini karena ada permintaan untuk mereset password akun Anda.

Klik link berikut untuk membuat password baru:

${resetUrl}

Link ini berlaku selama 30 menit.

Jika Anda tidak meminta reset password, abaikan email ini.
`,

    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Reset Password</h2>

        <p>
          Kami menerima permintaan untuk mereset
          password akun Anda.
        </p>

        <p>
          Klik tombol berikut untuk membuat
          password baru:
        </p>

        <p>
          <a
            href="${resetUrl}"
            style="
              display:inline-block;
              padding:12px 20px;
              background:#000;
              color:#fff;
              text-decoration:none;
              border-radius:6px;
            "
          >
            Reset Password
          </a>
        </p>

        <p>
          Link ini berlaku selama
          <strong>30 menit</strong>.
        </p>

        <p>
          Jika Anda tidak meminta reset password,
          abaikan email ini.
        </p>
      </div>
    `,
  });
}