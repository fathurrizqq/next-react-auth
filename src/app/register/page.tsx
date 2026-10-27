// register/page.tsx
// Halaman registrasi 2 langkah: (1) isi data -> kode OTP dikirim ke email,
// (2) masukkan kode. Akun baru menunggu aktivasi Super Admin.

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

// Langkah saat ini: form = isi data, verify = masukkan kode.
type Step = "form" | "verify";

// Jeda tombol "Kirim ulang" (sama dengan batas di server).
const RESEND_SECONDS = 60;

// Komponen halaman registrasi.
export default function RegisterPage() {
  const router = useRouter();

  // Langkah yang sedang tampil.
  const [step, setStep] = useState<Step>("form");

  // Isian form registrasi.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Kode OTP yang diketik.
  const [code, setCode] = useState("");

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

  // Minta server mengirim kode OTP ke email. Mengembalikan true jika berhasil.
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

  // Langkah 1: validasi singkat lalu minta kode OTP.
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

    // Password harus memenuhi semua syarat (server tetap memeriksa ulang).
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

  // Kirim ulang kode (hanya bila cooldown sudah habis).
  async function handleResend() {
    if (loading || cooldown > 0) return;

    setError("");
    await requestCode();
  }

  // Langkah 2: kirim kode OTP; jika benar, akun dibuat.
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
    // Tampilkan pesan dari server (akun menunggu aktivasi) dan biarkan tombol tetap nonaktif.
    setInfo(result.message);

    // Setelah 4 detik arahkan ke halaman login.
    window.setTimeout(() => router.push("/login"), 4000);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Register</h1>

        {/* Tampilkan form langkah 1 atau langkah 2. */}
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