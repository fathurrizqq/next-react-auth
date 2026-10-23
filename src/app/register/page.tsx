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

type Step = "form" | "verify";

const RESEND_SECONDS = 60;

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

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

    const result = await postJson("/api/auth/register/request", {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
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

  async function handleSubmitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setInfo("");

    if (name.trim().length < 4) {
      setError("Nama minimal 4 karakter.");
      return;
    }

    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }

    if (!PASSWORD_RULES.every((rule) => rule.test(password))) {
      setError("Password belum memenuhi semua persyaratan.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password dan konfirmasi password tidak sama.");
      return;
    }

    if (await requestCode()) {
      setStep("verify");
    }
  }

  async function handleResend() {
    if (loading || cooldown > 0) return;

    setError("");
    await requestCode();
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (code.length !== 6) {
      setError("Masukkan 6 digit kode verifikasi.");
      return;
    }

    setLoading(true);

    const result = await postJson("/api/auth/register/verify", {
      email: email.trim().toLowerCase(),
      code,
    });

    if (!result.ok) {
      setLoading(false);
      setError(result.message);
      return;
    }

    // Pesan dari server menjelaskan bahwa akun menunggu aktivasi.
    // Tombol tetap nonaktif (loading) sampai redirect.
    setInfo(result.message);

    window.setTimeout(() => router.push("/login"), 4000);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Register</h1>

        {step === "form" ? (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Buat akun baru. Kode verifikasi akan dikirim ke email Anda, dan
              akun perlu diaktifkan oleh Super Admin sebelum bisa digunakan.
            </p>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Nama
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder="Nama lengkap"
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                />
              </div>

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

              <div>
                <PasswordInput
                  id="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  placeholder="Buat password"
                  disabled={loading}
                />

                <PasswordRules value={password} />
              </div>

              <div>
                <PasswordInput
                  id="confirmPassword"
                  label="Konfirmasi Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  placeholder="Ulangi password"
                  disabled={loading}
                />

                {confirmPassword && (
                  <p
                    className={`mt-1 text-xs ${
                      password === confirmPassword
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {password === confirmPassword
                      ? "Password cocok."
                      : "Password tidak sama."}
                  </p>
                )}
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-black px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Mengirim kode..." : "Kirim Kode Verifikasi"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Masukkan kode 6 digit yang dikirim ke{" "}
              <span className="font-medium text-slate-700">
                {email.trim().toLowerCase()}
              </span>
              .
            </p>

            <form onSubmit={handleVerify} className="space-y-4">
              <CodeInput
                id="code"
                value={code}
                onChange={setCode}
                disabled={loading}
              />

              {info && <Alert type="success">{info}</Alert>}
              {error && <Alert type="error">{error}</Alert>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-black px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Memverifikasi..." : "Verifikasi & Daftar"}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setCode("");
                    setError("");
                    setInfo("");
                  }}
                  disabled={loading}
                  className="text-slate-600 underline underline-offset-2 hover:text-black disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                >
                  Ubah data
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
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-medium text-black underline underline-offset-2"
          >
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}