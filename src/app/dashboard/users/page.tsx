"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UserRole =
  | "USER"
  | "ADMIN"
  | "SUPER_ADMIN";

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function UserManagementPage() {
  const router = useRouter();

  // =========================================
  // USERS
  // =========================================

  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // =========================================
  // SELECTED USER
  // =========================================

  const [selectedUser, setSelectedUser] =
    useState<User | null>(null);

  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);

  // =========================================
  // FORM
  // =========================================

  const [editName, setEditName] = useState("");

  const [editEmail, setEditEmail] = useState("");

  const [editRole, setEditRole] =
    useState<UserRole>("USER");

  const [editActive, setEditActive] =
    useState(true);

  // =========================================
  // GET USERS
  // =========================================

  async function loadUsers() {
    try {
      const response = await fetch(
        "/api/admin/users",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        /*
         * Jangan langsung redirect ke dashboard
         * ketika 403.
         *
         * Kita tampilkan error supaya kita bisa
         * mengetahui apakah API menolak
         * SUPER_ADMIN.
         */
        if (response.status === 403) {
          setError(
            data.message ??
              "Anda tidak memiliki akses ke halaman ini. Pastikan akun Anda memiliki role SUPER_ADMIN.",
          );

          return;
        }

        throw new Error(
          data.message ??
            "Gagal mengambil user.",
        );
      }

      setUsers(data.users ?? []);
      setError("");
    } catch (error) {
      console.error(
        "LOAD_USERS_ERROR:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Tidak dapat mengambil data user.",
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // INITIAL LOAD
  // =========================================

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      try {
        const response = await fetch(
          "/api/admin/users",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const data = await response.json();

        /*
         * Jangan update state jika component
         * sudah tidak aktif.
         */
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/login");
            return;
          }

          if (response.status === 403) {
            setError(
              data.message ??
                "Anda tidak memiliki akses ke halaman ini. Pastikan akun Anda memiliki role SUPER_ADMIN.",
            );

            return;
          }

          setError(
            data.message ??
              "Gagal mengambil data user.",
          );

          return;
        }

        setUsers(data.users ?? []);
        setError("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "INITIAL_LOAD_USERS_ERROR:",
          error,
        );

        setError(
          "Tidak dapat mengambil data user.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchUsers();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // =========================================
  // OPEN EDIT MODAL
  // =========================================

  function openEditModal(user: User) {
    setSelectedUser(user);

    setEditName(user.name);

    setEditEmail(user.email);

    setEditRole(user.role);

    setEditActive(user.isActive);

    setError("");
  }

  // =========================================
  // CLOSE EDIT MODAL
  // =========================================

  function closeEditModal() {
    if (saving || deleting) {
      return;
    }

    setSelectedUser(null);

    setEditName("");

    setEditEmail("");

    setEditRole("USER");

    setEditActive(true);
  }

  // =========================================
  // UPDATE USER
  // =========================================

  async function handleUpdateUser() {
    if (!selectedUser) {
      return;
    }

    // =========================================
    // VALIDASI NAMA
    // =========================================

    if (!editName.trim()) {
      setError("Nama wajib diisi.");
      return;
    }

    // =========================================
    // VALIDASI EMAIL
    // =========================================

    if (!editEmail.trim()) {
      setError("Email wajib diisi.");
      return;
    }

    setSaving(true);

    setError("");

    try {
      const response = await fetch(
        `/api/admin/users/${selectedUser.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: editName.trim(),
            email: editEmail
              .trim()
              .toLowerCase(),
            role: editRole,
            isActive: editActive,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ??
            "Gagal memperbarui user.",
        );

        return;
      }

      // =========================================
      // TUTUP MODAL
      // =========================================

      setSelectedUser(null);

      // =========================================
      // RESET FORM
      // =========================================

      setEditName("");

      setEditEmail("");

      setEditRole("USER");

      setEditActive(true);

      // =========================================
      // LOAD DATA TERBARU
      // =========================================

      await loadUsers();

      // =========================================
      // REFRESH SERVER
      // =========================================

      router.refresh();
    } catch (error) {
      console.error(
        "UPDATE_USER_ERROR:",
        error,
      );

      setError(
        "Tidak dapat terhubung ke server.",
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================
  // DELETE USER
  // =========================================

  async function handleDeleteUser(
    user: User,
  ) {
    const confirmed = window.confirm(
      `Yakin ingin menghapus user "${user.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    setError("");

    try {
      const response = await fetch(
        `/api/admin/users/${user.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        window.alert(
          data.message ??
            "Gagal menghapus user.",
        );

        return;
      }

      await loadUsers();
    } catch (error) {
      console.error(
        "DELETE_USER_ERROR:",
        error,
      );

      window.alert(
        "Tidak dapat terhubung ke server.",
      );
    } finally {
      setDeleting(false);
    }
  }

  // =========================================
  // GROUP USER
  // =========================================

  const superAdmins = users.filter(
    (user) =>
      user.role === "SUPER_ADMIN",
  );

  const admins = users.filter(
    (user) => user.role === "ADMIN",
  );

  const normalUsers = users.filter(
    (user) => user.role === "USER",
  );

  // =========================================
  // USER CARD
  // =========================================

  function renderUserCard(
    title: string,
    cardUsers: User[],
  ) {
    return (
      <section className="rounded-xl bg-white p-5 shadow-sm">
        {/* CARD HEADER */}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {title}
          </h2>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {cardUsers.length}
          </span>
        </div>

        {/* EMPTY */}

        {cardUsers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Belum ada user.
          </div>
        ) : (
          <div className="space-y-3">
            {cardUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                {/* USER INFO */}

                <div className="flex min-w-0 items-center gap-3">
                  {/* AVATAR */}

                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200">
                    <Image
                      src={
                        user.avatar ??
                        "/default-avatar.svg"
                      }
                      alt={`Avatar ${user.name}`}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>

                  {/* NAME / EMAIL / STATUS */}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {user.name}
                    </p>

                    <p className="truncate text-xs text-slate-500">
                      {user.email}
                    </p>

                    <div className="mt-1">
                      {user.isActive ? (
                        <span className="text-xs text-green-600">
                          Aktif
                        </span>
                      ) : (
                        <span className="text-xs text-red-600">
                          Tidak aktif
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ACTION */}

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openEditModal(user)
                    }
                    disabled={deleting}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteUser(user)
                    }
                    disabled={deleting}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting
                      ? "..."
                      : "Hapus"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  // =========================================
  // RENDER
  // =========================================

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* =========================================
            HEADER
        ========================================= */}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              User Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Kelola seluruh pengguna dan role
              sistem.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push("/dashboard")
            }
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Kembali
          </button>
        </div>

        {/* =========================================
            ERROR
        ========================================= */}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* =========================================
            LOADING
        ========================================= */}

        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">
            Memuat data user...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* SUPER ADMIN */}

            {renderUserCard(
              "Super Admin",
              superAdmins,
            )}

            {/* ADMIN */}

            {renderUserCard(
              "Admin",
              admins,
            )}

            {/* USER */}

            {renderUserCard(
              "User Biasa",
              normalUsers,
            )}
          </div>
        )}
      </div>

      {/* =========================================
          EDIT USER MODAL
      ========================================= */}

      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditModal();
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            {/* MODAL HEADER */}

            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Edit User
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Ubah informasi dan role user.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={
                  saving || deleting
                }
                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {/* =========================================
                FORM
            ========================================= */}

            <div className="space-y-4">
              {/* NAME */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nama
                </label>

                <input
                  type="text"
                  value={editName}
                  onChange={(event) =>
                    setEditName(
                      event.target.value,
                    )
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                  placeholder="Nama lengkap"
                />
              </div>

              {/* EMAIL */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>

                <input
                  type="email"
                  value={editEmail}
                  onChange={(event) =>
                    setEditEmail(
                      event.target.value,
                    )
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                  placeholder="email@example.com"
                />
              </div>

              {/* ROLE */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Role
                </label>

                <select
                  value={editRole}
                  onChange={(event) =>
                    setEditRole(
                      event.target
                        .value as UserRole,
                    )
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                >
                  <option value="USER">
                    USER
                  </option>

                  <option value="ADMIN">
                    ADMIN
                  </option>

                  <option value="SUPER_ADMIN">
                    SUPER_ADMIN
                  </option>
                </select>
              </div>

              {/* STATUS */}

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(event) =>
                    setEditActive(
                      event.target.checked,
                    )
                  }
                  disabled={saving}
                  className="h-4 w-4"
                />

                <span className="text-sm text-slate-700">
                  Akun aktif
                </span>
              </label>
            </div>

            {/* SAVE */}

            <button
              type="button"
              onClick={
                handleUpdateUser
              }
              disabled={saving}
              className="mt-6 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Menyimpan..."
                : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}