"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const token =
    searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

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

    if (!token) {
      setError(
        "Token reset password tidak ditemukan.",
      );
      return;
    }

    if (!newPassword) {
      setError(
        "Password baru wajib diisi.",
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
      newPassword !==
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
          "/api/auth/reset-password",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              token,
              newPassword,
              confirmPassword,
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.message ??
            "Gagal mereset password.",
        );
        return;
      }

      setSuccess(
        "Password berhasil direset. Mengarahkan ke halaman login...",
      );

      setTimeout(() => {
        router.push("/login");
      }, 1500);
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
          Reset Password
        </h1>

        <p className="mt-2 mb-6 text-sm text-slate-500">
          Buat password baru untuk akun kamu.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">
              Password Baru
            </label>

            <div className="relative">
              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border px-3 py-2 pr-12"
                placeholder="Password baru"
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) => !value,
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500"
              >
                {showPassword
                  ? "Sembunyikan"
                  : "Lihat"}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Ulangi Password Baru
            </label>

            <div className="relative">
              <input
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
                className="w-full rounded-lg border px-3 py-2 pr-12"
                placeholder="Ulangi password baru"
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (value) => !value,
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500"
              >
                {showConfirmPassword
                  ? "Sembunyikan"
                  : "Lihat"}
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium">
              Password harus memiliki:
            </p>

            <ul className="mt-1 space-y-1">
              <li>• Minimal 8 karakter</li>
              <li>• Huruf kapital</li>
              <li>• Huruf kecil</li>
              <li>• Angka</li>
              <li>• Karakter khusus</li>
            </ul>
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
              ? "Menyimpan..."
              : "Reset Password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link
            href="/login"
            className="font-medium text-black underline"
          >
            Kembali ke Login
          </Link>
        </p>
      </div>
    </main>
  );
}