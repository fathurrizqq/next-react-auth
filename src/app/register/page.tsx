"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const passwordRules = {
    minLength:
      password.length >= 8,

    uppercase:
      /[A-Z]/.test(password),

    lowercase:
      /[a-z]/.test(password),

    number:
      /[0-9]/.test(password),

    special:
      /[^A-Za-z0-9]/.test(
        password,
      ),
  };

  const passwordIsValid =
    passwordRules.minLength &&
    passwordRules.uppercase &&
    passwordRules.lowercase &&
    passwordRules.number &&
    passwordRules.special;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (!name.trim()) {
      setError(
        "Nama wajib diisi.",
      );
      return;
    }

    if (
      name.trim().length < 4
    ) {
      setError(
        "Nama minimal 4 karakter.",
      );
      return;
    }

    if (!email.trim()) {
      setError(
        "Email wajib diisi.",
      );
      return;
    }

    if (!password) {
      setError(
        "Password wajib diisi.",
      );
      return;
    }

    if (!passwordIsValid) {
      setError(
        "Password belum memenuhi semua persyaratan.",
      );
      return;
    }

    if (!confirmPassword) {
      setError(
        "Konfirmasi password wajib diisi.",
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Password dan konfirmasi password tidak sama.",
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/register",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: name.trim(),
              email:
                email
                  .trim()
                  .toLowerCase(),
              password,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        const fieldErrors =
          data.errors;

        if (fieldErrors) {
          const firstError =
            fieldErrors.name?.[0] ??
            fieldErrors.email?.[0] ??
            fieldErrors.password?.[0];

          setError(
            firstError ??
              data.message ??
              "Data registrasi tidak valid.",
          );
        } else {
          setError(
            data.message ??
              "Registrasi gagal.",
          );
        }

        return;
      }

      router.push("/login");
    } catch {
      setError(
        "Tidak dapat terhubung ke server.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          Register
        </h1>

        <p className="mb-6 text-sm text-slate-500">
          Buat akun baru untuk
          menggunakan aplikasi.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
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
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-black"
              placeholder="Nama lengkap"
              autoComplete="name"
              disabled={loading}
            />

            {name &&
              name.trim().length <
                4 && (
                <p className="mt-1 text-xs text-red-500">
                  Nama minimal 4
                  karakter.
                </p>
              )}
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
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border px-3 py-2 text-slate-900 outline-none focus:border-black"
              placeholder="email@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

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
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border px-3 py-2 pr-20 text-slate-900 outline-none focus:border-black"
                placeholder="Buat password"
                autoComplete="new-password"
                disabled={loading}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current,
                  )
                }
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 hover:text-black disabled:opacity-50"
              >
                {showPassword
                  ? "Sembunyikan"
                  : "Lihat"}
              </button>
            </div>

            <div className="mt-2 space-y-1 text-xs">
              <PasswordRule
                valid={
                  passwordRules.minLength
                }
                text="Minimal 8 karakter"
              />

              <PasswordRule
                valid={
                  passwordRules.uppercase
                }
                text="Minimal 1 huruf kapital"
              />

              <PasswordRule
                valid={
                  passwordRules.lowercase
                }
                text="Minimal 1 huruf kecil"
              />

              <PasswordRule
                valid={
                  passwordRules.number
                }
                text="Minimal 1 angka"
              />

              <PasswordRule
                valid={
                  passwordRules.special
                }
                text="Minimal 1 karakter khusus"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Konfirmasi Password
            </label>

            <div className="relative">
              <input
                id="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={
                  confirmPassword
                }
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border px-3 py-2 pr-20 text-slate-900 outline-none focus:border-black"
                placeholder="Ulangi password"
                autoComplete="new-password"
                disabled={loading}
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (current) =>
                      !current,
                  )
                }
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 hover:text-black disabled:opacity-50"
              >
                {showConfirmPassword
                  ? "Sembunyikan"
                  : "Lihat"}
              </button>
            </div>

            {confirmPassword && (
              <p
                className={`mt-1 text-xs ${
                  password ===
                  confirmPassword
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {password ===
                confirmPassword
                  ? "Password cocok."
                  : "Password tidak sama."}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-2 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Mendaftarkan..."
              : "Register"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-medium text-black underline"
          >
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}

function PasswordRule({
  valid,
  text,
}: {
  valid: boolean;
  text: string;
}) {
  return (
    <p
      className={
        valid
          ? "text-green-600"
          : "text-slate-400"
      }
    >
      {valid ? "✓" : "○"} {text}
    </p>
  );
}