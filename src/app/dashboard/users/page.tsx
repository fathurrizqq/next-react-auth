// users/page.tsx
// Halaman User Management (khusus Super Admin).
// Kiri (70%): daftar user dikelompokkan per role + akun yang menunggu aktivasi.
// Kanan (30%): log aktivitas. Data diperbarui otomatis tiap 20 detik.

"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

// Role yang tersedia (sama dengan enum UserRole di database).
type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

// Data satu user dari GET /api/admin/users.
type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  lastSeen: string | null;
};

// Data satu baris log dari GET /api/admin/activity-logs.
type ActivityLog = {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
};

// User dianggap online jika lastSeen masih dalam 60 detik
// (sama dengan sistem heartbeat navbar).
const ONLINE_THRESHOLD = 60 * 1000;

// Data user dan log diperbarui setiap 20 detik.
const REFRESH_INTERVAL = 20 * 1000;

// Jumlah log yang dimuat per halaman.
const LOG_PAGE_SIZE = 30;

// Label dan warna badge untuk tiap jenis aktivitas.
// Jenis yang tidak terdaftar ditampilkan apa adanya.
const ACTION_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  REGISTER: {
    label: "Registrasi",
    className: "bg-sky-50 text-sky-700",
  },
  LOGIN: {
    label: "Login",
    className: "bg-green-50 text-green-700",
  },
  LOGIN_FAILED: {
    label: "Login gagal",
    className: "bg-red-50 text-red-700",
  },
  LOGOUT: {
    label: "Logout",
    className: "bg-slate-100 text-slate-600",
  },
  PASSWORD_CHANGED: {
    label: "Ganti password",
    className: "bg-amber-50 text-amber-700",
  },
  PASSWORD_RESET: {
    label: "Reset password",
    className: "bg-amber-50 text-amber-700",
  },
  EMAIL_CHANGED: {
    label: "Ganti email",
    className: "bg-amber-50 text-amber-700",
  },
  PROFILE_UPDATED: {
    label: "Ubah profil",
    className: "bg-slate-100 text-slate-600",
  },
  USER_UPDATED: {
    label: "Ubah user",
    className: "bg-indigo-50 text-indigo-700",
  },
  USER_DELETED: {
    label: "Hapus user",
    className: "bg-red-50 text-red-700",
  },
};

// User dianggap online jika lastSeen-nya masih dalam ONLINE_THRESHOLD.
function isUserOnline(lastSeen: string | null) {
  if (!lastSeen) {
    return false;
  }

  const lastSeenTime = new Date(lastSeen).getTime();

  if (Number.isNaN(lastSeenTime)) {
    return false;
  }

  return Date.now() - lastSeenTime <= ONLINE_THRESHOLD;
}

// Format waktu log: tanggal + jam, zona Jakarta.
function formatLogTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

// Komponen halaman User Management.
export default function UserManagementPage() {
  const router = useRouter();

  // =========================================
  // USERS
  // =========================================

  // Semua user dari server.
  const [users, setUsers] = useState<User[]>([]);
  // true sampai data user pertama selesai dimuat.
  const [loading, setLoading] = useState(true);
  // Pesan error halaman.
  const [error, setError] = useState("");

  // Id user yang sedang diaktifkan / dihapus.
  const [busyId, setBusyId] = useState<string | null>(null);

  // =========================================
  // EDIT MODAL
  // =========================================

  // User yang sedang diedit (null = modal tertutup).
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  // true saat perubahan sedang disimpan.
  const [saving, setSaving] = useState(false);
  // Pesan error di dalam modal.
  const [modalError, setModalError] = useState("");

  // Isian form edit: nama, email, role, dan status aktif.
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("USER");
  const [editActive, setEditActive] = useState(true);

  // =========================================
  // ACTIVITY LOGS
  // =========================================

  // Daftar log yang sudah dimuat.
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  // true sampai log pertama selesai dimuat.
  const [logsLoading, setLogsLoading] = useState(true);
  // Pesan error khusus panel log.
  const [logsError, setLogsError] = useState("");
  // Cursor halaman log berikutnya (null = sudah habis).
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // true saat "Muat lebih banyak" berjalan.
  const [loadingMore, setLoadingMore] = useState(false);

  // Cursor halaman berikutnya hanya ditentukan oleh load pertama.
  // Refresh otomatis hanya menambahkan log baru di bagian atas.
  const logsLoadedRef = useRef(false);

  // =========================================
  // LOAD DATA
  // =========================================

  // Ambil daftar user dari server.
  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          // Sesi habis -> kembali ke halaman login.
          router.push("/login");
          return;
        }

        setError(
          data.message ??
            (response.status === 403
              ? "Anda tidak memiliki akses ke halaman ini. Pastikan akun Anda memiliki role SUPER_ADMIN."
              : "Gagal mengambil data user."),
        );

        return;
      }

      setUsers(data.users ?? []);
      setError("");
    } catch (loadError) {
      console.error("LOAD_USERS_ERROR:", loadError);

      setError("Tidak dapat mengambil data user.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Ambil log terbaru; log baru ditaruh di atas yang sudah ada (tanpa duplikat).
  const refreshLogs = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/activity-logs?limit=${LOG_PAGE_SIZE}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status !== 401) {
          setLogsError(
            data.message ?? "Gagal mengambil log aktivitas.",
          );
        }

        return;
      }

      const incoming: ActivityLog[] = data.logs ?? [];

      setLogs((previous) => {
        // Kumpulan id log yang sudah ada, untuk mencegah duplikat.
        const known = new Set(previous.map((log) => log.id));

        return [
          ...incoming.filter((log) => !known.has(log.id)),
          ...previous,
        ];
      });

      if (!logsLoadedRef.current) {
        logsLoadedRef.current = true;
        setNextCursor(data.nextCursor ?? null);
      }

      setLogsError("");
    } catch (logError) {
      console.error("LOAD_LOGS_ERROR:", logError);

      setLogsError("Tidak dapat mengambil log aktivitas.");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Muat ulang user dan log sekaligus.
  const refreshAll = useCallback(async () => {
    await Promise.all([loadUsers(), refreshLogs()]);
  }, [loadUsers, refreshLogs]);

  // Muat data saat halaman dibuka, lalu ulangi tiap 20 detik saat tab terlihat.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshAll();
    }, 0);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshAll();
      }
    }, REFRESH_INTERVAL);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [refreshAll]);

  // Muat log yang lebih lama memakai cursor.
  async function handleLoadMoreLogs() {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);

    try {
      const response = await fetch(
        `/api/admin/activity-logs?limit=${LOG_PAGE_SIZE}&cursor=${encodeURIComponent(nextCursor)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setLogsError(
          data.message ?? "Gagal memuat log yang lebih lama.",
        );

        return;
      }

      const older: ActivityLog[] = data.logs ?? [];

      setLogs((previous) => {
        const known = new Set(previous.map((log) => log.id));

        return [
          ...previous,
          ...older.filter((log) => !known.has(log.id)),
        ];
      });

      setNextCursor(data.nextCursor ?? null);
      setLogsError("");
    } catch (moreError) {
      console.error("LOAD_MORE_LOGS_ERROR:", moreError);

      setLogsError("Tidak dapat memuat log yang lebih lama.");
    } finally {
      setLoadingMore(false);
    }
  }

  // =========================================
  // EDIT MODAL
  // =========================================

  // Buka modal edit dan isi form dengan data user.
  function openEditModal(user: User) {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditActive(user.isActive);
    setModalError("");
  }

  // Tutup modal (diabaikan saat sedang menyimpan).
  function closeEditModal() {
    if (saving) {
      return;
    }

    setSelectedUser(null);
    setModalError("");
  }

  // Simpan perubahan user (PATCH ke server).
  async function handleUpdateUser() {
    if (!selectedUser || saving) {
      return;
    }

    if (!editName.trim()) {
      setModalError("Nama wajib diisi.");
      return;
    }

    if (!editEmail.trim()) {
      setModalError("Email wajib diisi.");
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      const response = await fetch(
        `/api/admin/users/${selectedUser.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editName.trim(),
            email: editEmail.trim().toLowerCase(),
            role: editRole,
            isActive: editActive,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setModalError(
          data.errors?.name?.[0] ??
            data.errors?.email?.[0] ??
            data.message ??
            "Gagal memperbarui user.",
        );

        return;
      }

      setSelectedUser(null);

      await refreshAll();
    } catch (updateError) {
      console.error("UPDATE_USER_ERROR:", updateError);

      setModalError("Tidak dapat terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  // =========================================
  // ACTIVATE / DELETE
  // =========================================

  // Aktifkan akun (dipakai untuk akun yang menunggu aktivasi).
  async function handleActivateUser(user: User) {
    if (busyId) {
      return;
    }

    const confirmed = window.confirm(
      `Aktifkan akun "${user.name}" (${user.email})?`,
    );

    if (!confirmed) {
      return;
    }

    setBusyId(user.id);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: true,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        window.alert(data.message ?? "Gagal mengaktifkan user.");
        return;
      }

      await refreshAll();
    } catch (activateError) {
      console.error("ACTIVATE_USER_ERROR:", activateError);

      window.alert("Tidak dapat terhubung ke server.");
    } finally {
      setBusyId(null);
    }
  }

  // Hapus user setelah konfirmasi.
  async function handleDeleteUser(user: User) {
    if (busyId) {
      return;
    }

    const confirmed = window.confirm(
      `Yakin ingin menghapus user "${user.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setBusyId(user.id);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        window.alert(data.message ?? "Gagal menghapus user.");
        return;
      }

      await refreshAll();
    } catch (deleteError) {
      console.error("DELETE_USER_ERROR:", deleteError);

      window.alert("Tidak dapat terhubung ke server.");
    } finally {
      setBusyId(null);
    }
  }

  // =========================================
  // GROUP USERS
  // =========================================

  // Pengelompokan: akun nonaktif / menunggu aktivasi ditaruh paling atas.
  const inactiveUsers = users.filter((user) => !user.isActive);

  // Lalu akun aktif dikelompokkan per role.
  const superAdmins = users.filter(
    (user) => user.isActive && user.role === "SUPER_ADMIN",
  );

  const admins = users.filter(
    (user) => user.isActive && user.role === "ADMIN",
  );

  const normalUsers = users.filter(
    (user) => user.isActive && user.role === "USER",
  );

  // Matikan semua tombol aksi saat ada proses yang berjalan.
  const actionsDisabled = busyId !== null || saving;

  // =========================================
  // USER SECTION
  // =========================================

  // Menggambar satu kartu daftar user (judul + daftar user).
  function renderSection(
    title: string,
    sectionUsers: User[],
    emptyText: string,
    highlight = false,
  ) {
    return (
      <section
        className={`rounded-xl p-5 shadow-sm ${
          highlight
            ? "border border-amber-200 bg-amber-50/50"
            : "bg-white"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {title}
          </h2>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {sectionUsers.length}
          </span>
        </div>

        {sectionUsers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-3">
            {sectionUsers.map((user) => {
              const online =
                user.isActive && isUserOnline(user.lastSeen);

              const busy = busyId === user.id;

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200">
                      <Image
                        src={user.avatar ?? "/default-avatar.svg"}
                        alt={`Avatar ${user.name}`}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />

                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                          online ? "bg-green-500" : "bg-slate-300"
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {user.name}
                      </p>

                      <p className="truncate text-xs text-slate-500">
                        {user.email}
                      </p>

                      <div className="mt-1 flex items-center gap-2 text-xs font-medium">
                        {!user.isActive ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                            Nonaktif
                          </span>
                        ) : online ? (
                          <span className="text-green-600">Online</span>
                        ) : (
                          <span className="text-slate-400">Offline</span>
                        )}

                        {!user.isActive && (
                          <span className="text-slate-400">
                            {user.role}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {!user.isActive && (
                      <button
                        type="button"
                        onClick={() => handleActivateUser(user)}
                        disabled={actionsDisabled}
                        className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy ? "..." : "Aktifkan"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditModal(user)}
                      disabled={actionsDisabled}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      disabled={actionsDisabled}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "..." : "Hapus"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // =========================================
  // ACTIVITY LOG PANEL
  // =========================================

  // Menggambar panel log aktivitas di sisi kanan.
  function renderLogs() {
    return (
      <section className="rounded-xl bg-white p-5 shadow-sm lg:sticky lg:top-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Log Aktivitas
          </h2>

          <span className="text-xs text-slate-400">
            Diperbarui otomatis
          </span>
        </div>

        {logsError && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-600">
            {logsError}
          </div>
        )}

        {logsLoading ? (
          <div className="p-6 text-center text-sm text-slate-400">
            Memuat log...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            Belum ada aktivitas.
          </div>
        ) : (
          <ul className="max-h-[calc(100vh-11rem)] space-y-3 overflow-y-auto pr-1">
            {logs.map((log) => {
              const style = ACTION_STYLES[log.action] ?? {
                label: log.action,
                className: "bg-slate-100 text-slate-600",
              };

              return (
                <li
                  key={log.id}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
                    >
                      {style.label}
                    </span>

                    <time
                      dateTime={log.createdAt}
                      className="shrink-0 text-xs text-slate-400"
                    >
                      {formatLogTime(log.createdAt)}
                    </time>
                  </div>

                  <p className="mt-2 truncate text-sm font-medium text-slate-900">
                    {log.actorName ?? log.actorEmail ?? "Sistem"}
                  </p>

                  {log.actorName && log.actorEmail && (
                    <p className="truncate text-xs text-slate-500">
                      {log.actorEmail}
                    </p>
                  )}

                  {log.detail && (
                    <p className="mt-1 break-words text-xs text-slate-600">
                      {log.detail}
                    </p>
                  )}

                  {log.ip && (
                    <p className="mt-1 text-xs text-slate-400">
                      IP: {log.ip}
                    </p>
                  )}
                </li>
              );
            })}

            {nextCursor && (
              <li>
                <button
                  type="button"
                  onClick={handleLoadMoreLogs}
                  disabled={loadingMore}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMore ? "Memuat..." : "Muat lebih banyak"}
                </button>
              </li>
            )}
          </ul>
        )}
      </section>
    );
  }

  // =========================================
  // RENDER
  // =========================================

  // Tampilan halaman: kiri daftar user, kanan log aktivitas, lalu modal edit.
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              User Management
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Kelola seluruh pengguna dan role sistem.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Kembali
          </button>
        </div>

        {/* Pesan error halaman. */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">
            Memuat data user...
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-10">
            {/* KIRI: 70% */}
            <div className="space-y-6 lg:col-span-7">
              {inactiveUsers.length > 0 &&
                renderSection(
                  "Menunggu Aktivasi / Nonaktif",
                  inactiveUsers,
                  "Tidak ada akun yang menunggu.",
                  true,
                )}

              {renderSection(
                "Super Admin",
                superAdmins,
                "Belum ada user.",
              )}

              {renderSection("Admin", admins, "Belum ada user.")}

              {renderSection(
                "User Biasa",
                normalUsers,
                "Belum ada user.",
              )}
            </div>

            {/* KANAN: 30% */}
            <aside className="lg:col-span-3">{renderLogs()}</aside>
          </div>
        )}
      </div>

      {/* EDIT USER MODAL */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
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
                disabled={saving}
                aria-label="Tutup"
                className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="edit-name"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Nama
                </label>

                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                  placeholder="Nama lengkap"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-email"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>

                <input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-role"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Role
                </label>

                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(event) =>
                    setEditRole(event.target.value as UserRole)
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-black disabled:bg-slate-50"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(event) => setEditActive(event.target.checked)}
                  disabled={saving}
                  className="h-4 w-4"
                />

                <span className="text-sm text-slate-700">Akun aktif</span>
              </label>
            </div>

            {modalError && (
              <div
                role="alert"
                className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600"
              >
                {modalError}
              </div>
            )}

            <button
              type="button"
              onClick={handleUpdateUser}
              disabled={saving}
              className="mt-6 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}