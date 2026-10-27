// EmailSection.tsx
// Ganti email dalam 2 langkah: (1) isi email baru + password, (2) masukkan kode OTP
// yang dikirim ke email baru.

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import Alert from "@/src/app/components/Alert";
import CodeInput from "@/src/app/components/CodeInput";
import PasswordInput from "@/src/app/components/PasswordInput";
import { postJson } from "@/src/lib/api-client";

// Langkah saat ini: form = isi data, verify = masukkan kode.
type Step = "form" | "verify";

// Bagian ganti email di modal profil.
export default function EmailSection({
  currentEmail,
}: {
  currentEmail: string;
}) {
  const router = useRouter();

  // Langkah yang sedang tampil.
  const [step, setStep] = useState<Step>("form");

  // Email baru yang diketik.
  const [newEmail, setNewEmail] = useState("");
  // Password saat ini (bukti bahwa ini pemilik akun).
  const [password, setPassword] = useState("");
  // Kode OTP yang diketik.
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Email dibersihkan: tanpa spasi dan huruf kecil.
  const normalizedEmail = newEmail.trim().toLowerCase();

  // Langkah 1: minta kode OTP ke email baru.
  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    if (!normalizedEmail) {
      setError("Email baru wajib diisi.");
      return;
    }

    if (!password) {
      setError("Password wajib diisi.");
      return;
    }

    setLoading(true);

    // Kirim permintaan ke server.
    const result = await postJson("/api/auth/change-email/request", {
      newEmail: normalizedEmail,
      password,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccess(result.message);
    setPassword("");
    // Berhasil: lanjut ke langkah memasukkan kode.
    setStep("verify");
  }

  // Langkah 2: kirim kode OTP untuk menyelesaikan penggantian email.
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

    setLoading(true);

    // Kirim kode ke server.
    const result = await postJson("/api/auth/change-email/confirm", {
      newEmail: normalizedEmail,
      code,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccess("Email berhasil diubah.");
    setStep("form");
    setNewEmail("");
    setCode("");

    // Muat ulang data server agar email baru tampil di navbar.
    router.refresh();
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-slate-900">
        Ganti Email
      </h3>

      <p className="mb-4 text-xs text-slate-500">
        Email saat ini:{" "}
        <span className="font-medium text-slate-700">{currentEmail}</span>.
        Email hanya dapat diganti seminggu sekali dan perlu verifikasi kode.
      </p>

      {/* Tampilkan form langkah 1 atau langkah 2. */}
      {step === "form" ? (
        <form onSubmit={handleRequest} className="space-y-3">
          <div>
            <label
              htmlFor="new-email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email Baru
            </label>

            <input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              autoComplete="email"
              placeholder="email.baru@example.com"
              disabled={loading}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
            />
          </div>

          <PasswordInput
            id="email-password"
            label="Password Saat Ini"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="Konfirmasi dengan password"
            disabled={loading}
          />

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Mengirim kode..." : "Kirim Kode ke Email Baru"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirm} className="space-y-3">
          <p className="text-xs text-slate-500">
            Masukkan kode yang dikirim ke{" "}
            <span className="font-medium text-slate-700">
              {normalizedEmail}
            </span>
            .
          </p>

          <CodeInput
            id="email-code"
            value={code}
            onChange={setCode}
            disabled={loading}
          />

          {error && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">{success}</Alert>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Memverifikasi..." : "Verifikasi & Ganti Email"}
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