"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError(
        "Email wajib diisi.",
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/auth/forgot-password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              email,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.message ??
            "Gagal memproses permintaan.",
        );
        return;
      }

      setSuccess(
        "Jika email terdaftar, link reset password akan dikirim ke email tersebut.",
      );

      setEmail("");
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
        <h1 className="text-2xl font-bold">
          Lupa Password
        </h1>

        <p className="mt-2 mb-6 text-sm text-slate-500">
          Masukkan email akun kamu. Kami akan
          mengirimkan link untuk membuat password
          baru.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium"
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
              placeholder="email@example.com"
              className="w-full rounded-lg border px-3 py-2 outline-none focus:border-black"
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading
              ? "Mengirim..."
              : "Kirim Link Reset"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Ingat password?
          {" "}
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