"use client";

import Image from "next/image";
import {
  ChangeEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import OnlineUsers from "./OnlineUsers";

type DashboardNavbarProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
  };
};

export default function DashboardNavbar({
  user,
}: DashboardNavbarProps) {
  const router = useRouter();

  // Logout
  const [loading, setLoading] = useState(false);

  // Profile
  const [showProfileModal, setShowProfileModal] =
    useState(false);

  const [profileName, setProfileName] =
    useState(user.name);

  const [profileEmail, setProfileEmail] =
    useState(user.email);

  const [avatarFile, setAvatarFile] =
    useState<File | null>(null);

  const [avatarPreview, setAvatarPreview] =
    useState<string | null>(user.avatar);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [profileMessage, setProfileMessage] =
    useState("");

  const [profileError, setProfileError] =
    useState("");

  // Password
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [passwordLoading, setPasswordLoading] =
    useState(false);

  const [passwordMessage, setPasswordMessage] =
    useState("");

  const [passwordError, setPasswordError] =
    useState("");

  const isLoading =
    profileLoading || passwordLoading;

  // ==============================
  // LOGOUT
  // ==============================

  async function handleLogout() {
    if (loading) return;

    try {
      setLoading(true);

      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Logout gagal");
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error(
        "LOGOUT_ERROR:",
        error,
      );

      setLoading(false);
    }
  }

  // ==============================
  // PROFILE MODAL
  // ==============================

  function resetProfileForm() {
    setProfileName(user.name);
    setProfileEmail(user.email);

    setAvatarFile(null);
    setAvatarPreview(user.avatar);

    setProfileMessage("");
    setProfileError("");
  }

  function resetPasswordForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setPasswordMessage("");
    setPasswordError("");

    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }

  function handleOpenProfile() {
    resetProfileForm();
    resetPasswordForm();

    setShowProfileModal(true);
  }

  function handleCloseModal() {
    if (isLoading) return;

    setShowProfileModal(false);

    resetProfileForm();
    resetPasswordForm();
  }

  // ==============================
  // AVATAR
  // ==============================

  function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError(
        "File harus berupa gambar.",
      );

      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileError(
        "Ukuran foto maksimal 2 MB.",
      );

      event.target.value = "";
      return;
    }

    if (avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }

    const previewUrl =
      URL.createObjectURL(file);

    setProfileError("");
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
  }

  // ==============================
  // UPDATE PROFILE
  // ==============================

  async function handleUpdateProfile() {
    setProfileMessage("");
    setProfileError("");

    const name = profileName.trim();
    const email = profileEmail
      .trim()
      .toLowerCase();

    if (!name) {
      setProfileError(
        "Nama wajib diisi.",
      );
      return;
    }

    if (name.length < 4) {
      setProfileError(
        "Nama minimal 4 karakter.",
      );
      return;
    }

    if (!email) {
      setProfileError(
        "Email wajib diisi.",
      );
      return;
    }

    setProfileLoading(true);

    try {
      const formData = new FormData();

      formData.append("name", name);
      formData.append("email", email);

      if (avatarFile) {
        formData.append(
          "avatar",
          avatarFile,
        );
      }

      const response = await fetch(
        "/api/auth/profile",
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setProfileError(
          data.message ??
            "Gagal memperbarui profile.",
        );
        return;
      }

      setProfileMessage(
        "Profile berhasil diperbarui.",
      );

      setAvatarFile(null);

      router.refresh();

      setTimeout(() => {
        setShowProfileModal(false);
      }, 1000);
    } catch (error) {
      console.error(
        "PROFILE_UPDATE_ERROR:",
        error,
      );

      setProfileError(
        "Tidak dapat terhubung ke server.",
      );
    } finally {
      setProfileLoading(false);
    }
  }

  // ==============================
  // CHANGE PASSWORD
  // ==============================

  async function handleChangePassword() {
    setPasswordMessage("");
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError(
        "Password lama wajib diisi.",
      );
      return;
    }

    if (!newPassword) {
      setPasswordError(
        "Password baru wajib diisi.",
      );
      return;
    }

    if (!confirmPassword) {
      setPasswordError(
        "Konfirmasi password wajib diisi.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "Password baru dan konfirmasi password tidak sama.",
      );
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch(
        "/api/auth/change-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            confirmPassword,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(
          data.message ??
            "Gagal mengubah password.",
        );
        return;
      }

      setPasswordMessage(
        "Password berhasil diubah.",
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        setShowProfileModal(false);
        resetPasswordForm();
      }, 1200);
    } catch (error) {
      console.error(
        "CHANGE_PASSWORD_ERROR:",
        error,
      );

      setPasswordError(
        "Tidak dapat terhubung ke server.",
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  // ==============================
  // ROLE
  // ==============================

  function getRoleLabel(role: string) {
    switch (role) {
      case "SUPER_ADMIN":
        return "Super Admin";

      case "ADMIN":
        return "Admin";

      default:
        return "User";
    }
  }

  const avatarSource =
    avatarPreview ?? "/default-avatar.svg";

  // ==============================
  // RENDER
  // ==============================

  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-6">

          {/* Profile */}
          <button
            type="button"
            onClick={handleOpenProfile}
            className="flex items-center gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200">
              <Image
                src={avatarSource}
                alt={`Avatar ${user.name}`}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user.name}
              </p>

              <div className="flex max-w-100 items-center gap-2 text-xs text-slate-500">
                <span className="truncate">
                  {user.email}
                </span>

                <span className="text-slate-300">
                  |
                </span>

                <span className="shrink-0">
                  {getRoleLabel(user.role)}
                </span>
              </div>
            </div>
          </button>

          {/* Online Users */}
          <OnlineUsers
            currentUserId={user.id}
          />

          {/* Right Menu */}
          <div className="flex items-center gap-2">
            {user.role === "SUPER_ADMIN" && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/dashboard/users",
                  )
                }
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                User Management
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Logout..."
                : "Logout"}
            </button>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              handleCloseModal();
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Profil
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Kelola informasi akun kamu.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isLoading}
                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            {/* Avatar */}
            <div className="mb-6 flex flex-col items-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200">
                <Image
                  src={avatarSource}
                  alt="Preview avatar"
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>

              <label className="mt-3 cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                {avatarFile
                  ? "Ganti Foto"
                  : "Tambah / Ganti Foto"}

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={isLoading}
                  className="hidden"
                />
              </label>

              <p className="mt-2 text-xs text-slate-400">
                JPG, PNG, WEBP. Maksimal 2 MB.
              </p>
            </div>

            {/* Profile Information */}
            <div className="space-y-4">

              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nama
                </label>

                <input
                  type="text"
                  value={profileName}
                  onChange={(event) =>
                    setProfileName(
                      event.target.value,
                    )
                  }
                  disabled={isLoading}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                  placeholder="Nama lengkap"
                />
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  value={profileEmail}
                  onChange={(event) =>
                    setProfileEmail(
                      event.target.value,
                    )
                  }
                  disabled={isLoading}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                  placeholder="email@example.com"
                />
              </div>

              {/* Role */}
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
            </div>

            {/* Profile Error */}
            {profileError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {profileError}
              </div>
            )}

            {/* Profile Success */}
            {profileMessage && (
              <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                {profileMessage}
              </div>
            )}

            {/* Save Profile */}
            <button
              type="button"
              onClick={handleUpdateProfile}
              disabled={isLoading}
              className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileLoading
                ? "Menyimpan..."
                : "Simpan Profile"}
            </button>

            <div className="my-6 border-t" />

            {/* Change Password */}
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">
                Ganti Password
              </h3>

              <p className="mb-4 text-xs text-slate-500">
                Gunakan password lama untuk
                membuat password baru.
              </p>

              <div className="space-y-3">

                {/* Current Password */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Password Lama
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showCurrentPassword
                          ? "text"
                          : "password"
                      }
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(
                          event.target.value,
                        )
                      }
                      disabled={isLoading}
                      placeholder="Masukkan password lama"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(
                          (value) => !value,
                        )
                      }
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-black disabled:opacity-50"
                    >
                      {showCurrentPassword
                        ? "Sembunyikan"
                        : "Lihat"}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Password Baru
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showNewPassword
                          ? "text"
                          : "password"
                      }
                      value={newPassword}
                      onChange={(event) =>
                        setNewPassword(
                          event.target.value,
                        )
                      }
                      disabled={isLoading}
                      placeholder="Minimal 8 karakter"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowNewPassword(
                          (value) => !value,
                        )
                      }
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-black disabled:opacity-50"
                    >
                      {showNewPassword
                        ? "Sembunyikan"
                        : "Lihat"}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Konfirmasi Password
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(
                          event.target.value,
                        )
                      }
                      disabled={isLoading}
                      placeholder="Ulangi password baru"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (value) => !value,
                        )
                      }
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-black disabled:opacity-50"
                    >
                      {showConfirmPassword
                        ? "Sembunyikan"
                        : "Lihat"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Error */}
              {passwordError && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {passwordError}
                </div>
              )}

              {/* Password Success */}
              {passwordMessage && (
                <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                  {passwordMessage}
                </div>
              )}

              {/* Save Password */}
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={isLoading}
                className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {passwordLoading
                  ? "Menyimpan..."
                  : "Simpan Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}