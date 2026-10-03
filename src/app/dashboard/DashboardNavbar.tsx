"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DashboardNavbarProps = {
  user: {
    name: string;
    email: string;
    role: string;
  };
};

export default function DashboardNavbar({
  user,
}: DashboardNavbarProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] =
    useState(false);

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

  async function handleLogout() {
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

      router.push("src/app/auth/login");
      router.refresh();
    } catch (error) {
      console.error(
        "LOGOUT_ERROR:",
        error,
      );

      setLoading(false);
    }
  }

  function handleCloseModal() {
    if (passwordLoading) {
      return;
    }

    setShowProfileModal(false);

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setPasswordMessage("");
    setPasswordError("");
  }

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
        handleCloseModal();
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

  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-6">
          {/* USER PROFILE */}
          <button
            type="button"
            onClick={() =>
              setShowProfileModal(true)
            }
            className="rounded-lg px-2 py-1 text-left transition hover:bg-slate-50"
          >
            <p className="text-sm font-semibold text-slate-900">
              {user.name}
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{user.email}</span>

              <span className="text-slate-300">
                |
              </span>

              <span>
                {user.role}
              </span>
            </div>
          </button>

          {/* LOGOUT */}
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
      </header>

      {/* PROFILE MODAL */}
      {showProfileModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
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
            {/* MODAL HEADER */}
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
                disabled={passwordLoading}
                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            {/* PROFILE INFORMATION */}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nama
                </label>

                <input
                  type="text"
                  value={user.name}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Role
                </label>

                <input
                  type="text"
                  value={user.role}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                />
              </div>
            </div>

            {/* DIVIDER */}
            <div className="my-6 border-t" />

            {/* CHANGE PASSWORD */}
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">
                Ganti Password
              </h3>

              <p className="mb-4 text-xs text-slate-500">
                Gunakan password lama untuk membuat
                password baru.
              </p>

              <div className="space-y-3">
                {/* CURRENT PASSWORD */}
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
                      value={
                        currentPassword
                      }
                      onChange={(event) =>
                        setCurrentPassword(
                          event.target.value,
                        )
                      }
                      placeholder="Masukkan password lama"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm outline-none transition focus:border-black"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(
                          (value) =>
                            !value,
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-black"
                    >
                      {showCurrentPassword
                        ? "Sembunyikan"
                        : "Lihat"}
                    </button>
                  </div>
                </div>

                {/* NEW PASSWORD */}
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
                      placeholder="Minimal 8 karakter"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm outline-none transition focus:border-black"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowNewPassword(
                          (value) =>
                            !value,
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-black"
                    >
                      {showNewPassword
                        ? "Sembunyikan"
                        : "Lihat"}
                    </button>
                  </div>
                </div>

                {/* CONFIRM PASSWORD */}
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
                      value={
                        confirmPassword
                      }
                      onChange={(event) =>
                        setConfirmPassword(
                          event.target.value,
                        )
                      }
                      placeholder="Ulangi password baru"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm outline-none transition focus:border-black"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (value) =>
                            !value,
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-black"
                    >
                      {showConfirmPassword
                        ? "Sembunyikan"
                        : "Lihat"}
                    </button>
                  </div>
                </div>
              </div>

              {/* PASSWORD MESSAGE */}
              {passwordError && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {passwordError}
                </div>
              )}

              {passwordMessage && (
                <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
                  {passwordMessage}
                </div>
              )}

              {/* PASSWORD BUTTON */}
              <button
                type="button"
                onClick={
                  handleChangePassword
                }
                disabled={
                  passwordLoading
                }
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
