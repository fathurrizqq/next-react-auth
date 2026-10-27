// PasswordSection.tsx
// Ganti password dalam 2 langkah: (1) isi password lama, (2) masukkan kode OTP dari email
// dan password baru.

"use client";

import { useState, type FormEvent } from "react";

import Alert from "@/src/app/components/Alert";
import CodeInput from "@/src/app/components/CodeInput";
import PasswordInput from "@/src/app/components/PasswordInput";
import PasswordRules from "@/src/app/components/PasswordRules";
import { postJson } from "@/src/lib/api-client";
import { PASSWORD_RULES } from "@/src/lib/validation";

// Langkah saat ini: form = password lama, verify = kode + password baru.
type Step = "form" | "verify";

// Bagian ganti password di modal profil.
export default function PasswordSection() {
  // Langkah yang sedang tampil.
  const [step, setStep] = useState<Step>("form");

  // Password lama.
  const [currentPassword, setCurrentPassword] = useState("");
  // Kode OTP yang diketik.
  const [code, setCode] = useState("");
  // Password baru.
  const [newPassword, setNewPassword] = useState("");
  // Ulangi password baru.
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Langkah 1: verifikasi password lama dan minta kode OTP.
  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    if (!currentPassword) {
      setError("Password lama wajib diisi.");
      return;
    }

    setLoading(true);

    // Kirim permintaan ke server.
    const result = await postJson("/api/auth/change-password/request", {
      currentPassword,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccess(result.message);
    setCurrentPassword("");
    // Berhasil: lanjut ke langkah memasukkan kode dan password baru.
    setStep("verify");
  }

  // Langkah 2: kirim kode + password baru.
  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    // Kode harus 6 digit.
    if (code.length !== 6) {
      setError("Masukkan 6 digit kode verifikasi.");
      return;
    }

    // Password baru harus memenuhi semua syarat (server tetap memeriksa ulang).
    if (!PASSWORD_RULES.every((rule) => rule.test(newPassword))) {
      setError("Password baru belum memenuhi semua persyaratan.");
      return;
    }

    // Konfirmasi harus sama.
    if (newPassword !== confirmPassword) {
      setError("Password baru dan konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);

    // Kirim data ke server.
    const result = await postJson("/api/auth/change-password/confirm", {
      code,
      newPassword,
      confirmPassword,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccess(result.message);
    setStep("form");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-slate-900">
        Ganti Password
      </h3>

      <p className="mb-4 text-xs text-slate-500">
        Kode verifikasi akan dikirim ke email Anda. Password hanya dapat
        diganti seminggu sekali.
      </p>

      {/* Tampilkan form langkah 1 atau langkah 2. */}
      {step === "form" ? (
        <form onSubmit={handleRequest} className="space-y-3">
          <PasswordInput
            id="current-password"
            label="Password Lama"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            placeholder="Masukkan password lama"
            disabled={loading}
          />

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Mengirim kode..." : "Kirim Kode Verifikasi"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="space-y-3">
          <CodeInput
            id="password-code"
            value={code}
            onChange={setCode}
            disabled={loading}
          />

          <div>
            <PasswordInput
              id="new-password"
              label="Password Baru"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              placeholder="Password baru"
              disabled={loading}
            />

            <PasswordRules value={newPassword} />
          </div>

          <PasswordInput
            id="confirm-new-password"
            label="Konfirmasi Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            placeholder="Ulangi password baru"
            disabled={loading}
          />

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Simpan Password"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("form");
              setCode("");
              setError("");
              setSuccess("");
            }}
            disabled={loading}
            className="w-full text-sm text-slate-600 underline underline-offset-2 hover:text-black"
          >
            Batal
          </button>
        </form>
      )}
    </div>
  );
}