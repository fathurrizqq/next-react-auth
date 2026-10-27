// login/page.tsx
// Halaman login (email + password).

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import EyeIcon from "@/src/app/components/EyeIcon";

// Bentuk jawaban API login (pesan + error per field).
type LoginResponse = {
  message?: string;
  errors?: {
    email?: string[];
    password?: string[];
  };
};

// Komponen halaman login.
export default function LoginPage() {
  // Untuk pindah halaman setelah login.
  const router = useRouter();

  // Isi kolom email.
  const [email, setEmail] = useState("");
  // Isi kolom password.
  const [password, setPassword] = useState("");
  // Apakah password sedang ditampilkan.
  const [showPassword, setShowPassword] = useState(false);
  // Pesan error di atas tombol login.
  const [error, setError] = useState("");
  // true saat proses login berjalan.
  const [loading, setLoading] = useState(false);

  // Dijalankan saat form dikirim: validasi singkat lalu panggil API login.
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    // Cegah browser memuat ulang halaman.
    event.preventDefault();

    // Abaikan klik ganda saat proses berjalan.
    if (loading) return;

    setError("");

    // Email dibersihkan: tanpa spasi dan huruf kecil.
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Email wajib diisi.");
      return;
    }

    if (!password) {
      setError("Password wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      // Kirim email & password ke server.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      // Baca jawaban JSON; jika bukan JSON pakai objek kosong.
      const data: LoginResponse = await response
        .json()
        .catch(() => ({}));

      // Login ditolak: tampilkan pesan dari server.
      if (!response.ok) {
        const firstFieldError =
          data.errors?.email?.[0] ??
          data.errors?.password?.[0];

        setError(
          firstFieldError ??
          data.message ??
          "Login gagal. Silakan coba kembali.",
        );

        return;
      }

      // Login berhasil -> ke dashboard.
      router.push("/dashboard");
      // Muat ulang data server agar status login terbaca.
      router.refresh();
    // Gagal terhubung ke server.
    } catch {
      setError(
        "Terjadi masalah saat menghubungi server. Silakan coba kembali.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Tombol mata: tampilkan / sembunyikan password.
  function togglePasswordVisibility() {
    setShowPassword((current) => !current);
  }

  // Tampilan halaman login.
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        {/* Header */}
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          Login
        </h1>

        <p className="mb-6 text-sm text-slate-500">
          Masuk ke dashboard.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
              placeholder="email@example.com"
              autoComplete="email"
              disabled={loading}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-12 text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                placeholder="Masukkan password"
                autoComplete="current-password"
                disabled={loading}
                required
              />

              <button
                type="button"
                onClick={togglePasswordVisibility}
                disabled={loading}
                className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={
                  showPassword
                    ? "Sembunyikan password"
                    : "Tampilkan password"
                }
                aria-pressed={showPassword}
                aria-controls="password"
              >
                <EyeIcon hidden={!showPassword} />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-2 text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Login"}
          </button>
        </form>

        {/* Register */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-medium text-black underline underline-offset-2"
          >
            Register
          </Link>
        </p>

        {/* Forgot Password */}
        <div className="mt-2 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-slate-600 underline underline-offset-2 transition hover:text-black"
          >
            Lupa password?
          </Link>
        </div>
      </div>
    </main>
  );
}
