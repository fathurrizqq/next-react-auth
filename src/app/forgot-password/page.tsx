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

type Step = "email" | "reset";

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timeoutId = window.setTimeout(
      () => setCooldown((current) => current - 1),
      1000,
    );

    return () => window.clearTimeout(timeoutId);
  }, [cooldown]);

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

  async function handleResend() {
    if (loading || cooldown > 0) return;

    setError("");
    await requestCode();
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (code.length !== 6) {
      setError("Masukkan 6 digit kode verifikasi.");
      return;
    }

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

    window.setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          Lupa Password
        </h1>

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