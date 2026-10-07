"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

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

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email:
                email.trim().toLowerCase(),
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
            fieldErrors.email?.[0] ??
            fieldErrors.password?.[0];

          setError(
            firstError ??
              data.message ??
              "Login gagal.",
          );
        } else {
          setError(
            data.message ??
              "Login gagal.",
          );
        }

        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(
        "Tidak dapat terhubung ke server.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
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
                className="w-full rounded-lg border px-3 py-2 pr-12 text-slate-900 outline-none focus:border-black"
                placeholder="Password"
                autoComplete="current-password"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-black disabled:opacity-50"
                aria-label={
                  showPassword
                    ? "Sembunyikan password"
                    : "Tampilkan password"
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
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
              ? "Memproses..."
              : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-medium text-black underline"
          >
            Register
          </Link>
        </p>

        <div className="mt-2 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-slate-600 underline hover:text-black"
          >
            Lupa password?
          </Link>
        </div>
      </div>
    </main>
  );
}