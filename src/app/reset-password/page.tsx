"use client";

import {
  FormEvent,
  useState,
} from "react";

import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const searchParams =
    useSearchParams();

  const token =
    searchParams.get("token") ?? "";

  const [
    newPassword,
    setNewPassword,
  ] = useState("");

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

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const passwordRules = {
    minLength:
      newPassword.length >= 8,

    uppercase:
      /[A-Z]/.test(newPassword),

    lowercase:
      /[a-z]/.test(newPassword),

    number:
      /[0-9]/.test(newPassword),

    special:
      /[^A-Za-z0-9]/.test(
        newPassword,
      ),
  };

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

    if (
      !passwordRules.minLength ||
      !passwordRules.uppercase ||
      !passwordRules.lowercase ||
      !passwordRules.number ||
      !passwordRules.special
    ) {
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

      window.setTimeout(() => {
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
        <h1 className="text-2xl font-bold text-slate-900">
          Reset Password
        </h1>

        <p className="mb-6 mt-2 text-sm text-slate-500">
          Buat password baru untuk
          akun kamu.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1 block text-sm font-medium"
            >
              Password Baru
            </label>

            <div className="relative">
              <input
                id="newPassword"
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
                className="w-full rounded-lg border px-3 py-2 pr-20"
                placeholder="Password baru"
                autoComplete="new-password"
                disabled={loading}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) =>
                      !value,
                  )
                }
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500"
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
              className="mb-1 block text-sm font-medium"
            >
              Ulangi Password Baru
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
                className="w-full rounded-lg border px-3 py-2 pr-20"
                placeholder="Ulangi password baru"
                autoComplete="new-password"
                disabled={loading}
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (value) =>
                      !value,
                  )
                }
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500"
              >
                {showConfirmPassword
                  ? "Sembunyikan"
                  : "Lihat"}
              </button>
            </div>

            {confirmPassword && (
              <p
                className={`mt-1 text-xs ${
                  newPassword ===
                  confirmPassword
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {newPassword ===
                confirmPassword
                  ? "Password cocok."
                  : "Password tidak sama."}
              </p>
            )}
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