// forgot-password/page.tsx
// Halaman lupa password 2 langkah: (1) isi email -> kode OTP dikirim,
// (2) masukkan kode + password baru.

"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Alert from "@/src/app/components/Alert";
import CodeInput from "@/src/app/components/CodeInput";
import PasswordInput from "@/src/app/components/PasswordInput";
import PasswordRules from "@/src/app/components/PasswordRules";
import { postJson } from "@/src/lib/api-client";
import { PASSWORD_RULES } from "@/src/lib/validation";

// Langkah saat ini: email = isi email, reset = kode + password baru.
type Step = "email" | "reset";

// Jeda tombol "Kirim ulang" (sama dengan batas di server).
const RESEND_SECONDS = 60;

// Komponen halaman lupa password.
export default function ForgotPasswordPage() {
  const router = useRouter();

  // Langkah yang sedang tampil.
  const [step, setStep] = useState<Step>("email");

  // Isian form.
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Pesan error.
  const [error, setError] = useState("");
  // Pesan informasi / sukses.
  const [info, setInfo] = useState("");
  // true saat ada proses yang berjalan.
  const [loading, setLoading] = useState(false);
  // Sisa detik sebelum boleh kirim ulang kode.
  const [cooldown, setCooldown] = useState(0);

  // Hitung mundur cooldown tiap detik.
  useEffect(() => {
    if (cooldown <= 0) return;

    const timeoutId = window.setTimeout(
      () => setCooldown((current) => current - 1),
      1000,
    );

    return () => window.clearTimeout(timeoutId);
  }, [cooldown]);

  // Minta server mengirim kode OTP. Mengembalikan true jika berhasil.
  async function requestCode() {
    setLoading(true);

    const result = await postJson("/api/auth/forgot-password", {
      email: email.trim().toLowerCase(),
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return false;
    }

    setInfo(result.message);
    setCooldown(RESEND_SECONDS);

    return true;
  }

  // Langkah 1: kirim email untuk meminta kode.
  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }

    if (await requestCode()) {
      setStep("reset");
    }
  }

  // Kirim ulang kode (hanya bila cooldown sudah habis).
  async function handleResend() {
    if (loading || cooldown > 0) return;

    setError("");
    await requestCode();
  }

  // Langkah 2: kirim kode + password baru.
  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (code.length !== 6) {
      setError("Masukkan 6 digit kode verifikasi.");
      return;
    }

    // Password baru harus memenuhi semua syarat (server tetap memeriksa ulang).
    if (!PASSWORD_RULES.every((rule) => rule.test(newPassword))) {
      setError("Password belum memenuhi semua persyaratan.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password dan konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);

    const result = await postJson("/api/auth/reset-password", {
      email: email.trim().toLowerCase(),
      code,
      newPassword,
      confirmPassword,
    });

    if (!result.ok) {
      setLoading(false);
      setError(result.message);
      return;
    }

    setInfo("Password berhasil direset. Mengarahkan ke halaman login...");

    // Setelah 1,5 detik arahkan ke halaman login.
    window.setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          Lupa Password
        </h1>

        {/* Tampilkan form langkah 1 atau langkah 2. */}
        {step === "email" ? (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Masukkan email akun Anda. Kode reset akan dikirim jika email
              terdaftar.
            </p>

            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="email@example.com"
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                />
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-black px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Mengirim..." : "Kirim Kode"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Masukkan kode yang dikirim ke{" "}
              <span className="font-medium text-slate-700">
                {email.trim().toLowerCase()}
              </span>{" "}
              dan buat password baru.
            </p>

            <form onSubmit={handleReset} className="space-y-4">
              <CodeInput
                id="code"
                value={code}
                onChange={setCode}
                disabled={loading}
              />

              <div>
                <PasswordInput
                  id="newPassword"
                  label="Password Baru"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  placeholder="Password baru"
                  disabled={loading}
                />

                <PasswordRules value={newPassword} />
              </div>

              <div>
                <PasswordInput
                  id="confirmPassword"
                  label="Ulangi Password Baru"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                  disabled={loading}
                />

                {confirmPassword && (
                  <p
                    className={`mt-1 text-xs ${
                      newPassword === confirmPassword
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {newPassword === confirmPassword
                      ? "Password cocok."
                      : "Password tidak sama."}
                  </p>
                )}
              </div>

              {info && <Alert type="success">{info}</Alert>}
              {error && <Alert type="error">{error}</Alert>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-black px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : "Reset Password"}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                    setInfo("");
                  }}
                  disabled={loading}
                  className="text-slate-600 underline underline-offset-2 hover:text-black"
                >
                  Ubah email
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || cooldown > 0}
                  className="text-slate-600 underline underline-offset-2 hover:text-black disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                >
                  {cooldown > 0
                    ? `Kirim ulang (${cooldown}s)`
                    : "Kirim ulang kode"}
                </button>
              </div>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link
            href="/login"
            className="font-medium text-black underline underline-offset-2"
          >
            Kembali ke Login
          </Link>
        </p>
      </div>
    </main>
  );
}