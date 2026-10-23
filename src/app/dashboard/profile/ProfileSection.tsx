"use client";

import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import Alert from "@/src/app/components/Alert";
import { getRoleLabel } from "@/src/lib/roles";

type ProfileSectionProps = {
  user: {
    name: string;
    role: string;
    avatar: string | null;
  };
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export default function ProfileSection({ user }: ProfileSectionProps) {
  const router = useRouter();

  const [name, setName] = useState(user.name);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(user.avatar);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];

    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("Format foto harus JPG, PNG, atau WEBP.");
      event.target.value = "";
      return;
    }

    if (selected.size > MAX_AVATAR_SIZE) {
      setError("Ukuran foto maksimal 2 MB.");
      event.target.value = "";
      return;
    }

    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setError("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setSuccess("");

    if (name.trim().length < 4) {
      setError("Nama minimal 4 karakter.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("name", name.trim());

      if (file) {
        formData.append("avatar", file);
      }

      const response = await fetch("/api/auth/profile", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data.errors?.name?.[0] ??
            data.message ??
            "Gagal memperbarui profile.",
        );
        return;
      }

      setSuccess("Profile berhasil diperbarui.");
      setFile(null);
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col items-center">
        <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200">
          <Image
            src={preview ?? "/default-avatar.svg"}
            alt="Preview avatar"
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>

        <label className="mt-3 cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
          {file ? "Ganti Foto" : "Tambah / Ganti Foto"}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={loading}
            className="hidden"
          />
        </label>

        <p className="mt-2 text-xs text-slate-400">
          JPG, PNG, WEBP. Maksimal 2 MB.
        </p>
      </div>

      <div>
        <label
          htmlFor="profile-name"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Nama
        </label>

        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={loading}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
          placeholder="Nama lengkap"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Role
        </label>

        <input
          type="text"
          value={getRoleLabel(user.role)}
          disabled
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
        />
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Menyimpan..." : "Simpan Profile"}
      </button>
    </form>
  );
}