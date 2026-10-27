// ProfileSection.tsx
// Ubah nama dan foto profil (memanggil POST /api/auth/profile).

"use client";

import Image from "next/image";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import Alert from "@/src/app/components/Alert";
import { getRoleLabel } from "@/src/lib/roles";

// Data user yang ditampilkan.
type ProfileSectionProps = {
  user: {
    name: string;
    role: string;
    avatar: string | null;
  };
};

// Tipe foto yang diizinkan (dicek lagi di server).
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Ukuran foto maksimal 2 MB.
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

// Form nama + foto profil.
export default function ProfileSection({ user }: ProfileSectionProps) {
  const router = useRouter();

  // Isi kolom nama.
  const [name, setName] = useState(user.name);
  // File foto baru yang dipilih (null = tidak ganti foto).
  const [file, setFile] = useState<File | null>(null);
  // Gambar pratinjau: foto lama atau foto yang baru dipilih.
  const [preview, setPreview] = useState<string | null>(user.avatar);

  // true saat proses simpan berjalan.
  const [loading, setLoading] = useState(false);
  // Pesan error.
  const [error, setError] = useState("");
  // Pesan sukses.
  const [success, setSuccess] = useState("");

  // Saat user memilih foto: cek tipe & ukuran, lalu tampilkan pratinjau.
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];

    if (!selected) return;

    // Tipe tidak diizinkan.
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("Format foto harus JPG, PNG, atau WEBP.");
      event.target.value = "";
      return;
    }

    // Ukuran terlalu besar.
    if (selected.size > MAX_AVATAR_SIZE) {
      setError("Ukuran foto maksimal 2 MB.");
      event.target.value = "";
      return;
    }

    // Bebaskan memori dari pratinjau sebelumnya.
    if (preview?.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    setError("");
    setFile(selected);
    // Buat URL sementara untuk menampilkan foto yang dipilih.
    setPreview(URL.createObjectURL(selected));
  }

  // Simpan perubahan: validasi singkat lalu kirim ke server.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Cegah browser memuat ulang halaman saat form dikirim.
    event.preventDefault();

    // Abaikan jika proses sebelumnya masih berjalan.
    if (loading) return;

    setError("");
    setSuccess("");

    // Validasi singkat di browser (server tetap memvalidasi ulang).
    if (name.trim().length < 4) {
      setError("Nama minimal 4 karakter.");
      return;
    }

    setLoading(true);

    try {
      // Foto dikirim sebagai multipart form, bukan JSON.
      const formData = new FormData();

      formData.append("name", name.trim());

      // Sertakan foto hanya jika user memilih foto baru.
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
      // Muat ulang data server agar navbar menampilkan nama/foto terbaru.
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