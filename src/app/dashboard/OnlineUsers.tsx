// OnlineUsers.tsx
// Deretan foto user yang sedang online di navbar.
// Sekaligus mengirim "heartbeat" tiap 20 detik supaya user ini sendiri tercatat online.

"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { getRoleLabel } from "@/src/lib/roles";

// Data satu user online dari API.
type OnlineUser = {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  lastSeen: string | null;
};

// currentUserId dipakai untuk memberi label "(Anda)".
type OnlineUsersProps = {
  currentUserId: string;
};

// Maksimal foto yang ditampilkan; sisanya jadi angka "+N".
const MAX_VISIBLE_USERS = 5;
// Heartbeat dan refresh setiap 20 detik.
const REFRESH_INTERVAL = 20_000;

// Huruf pertama nama (untuk pengganti foto).
function getInitial(name: string) {
  return (
    name.trim().charAt(0).toUpperCase() ||
    "?"
  );
}

// Komponen daftar user online.
export default function OnlineUsers({
  currentUserId,
}: OnlineUsersProps) {
  // Daftar user yang sedang online.
  const [users, setUsers] = useState<OnlineUser[]>(
    [],
  );

  // true sebelum data pertama selesai dimuat.
  const [loading, setLoading] =
    useState(true);

  // Dua langkah: (1) POST = catat bahwa saya online (heartbeat),
  // (2) GET = ambil daftar semua yang online.
  const refreshOnlineStatus =
    useCallback(async () => {
      try {
        await fetch(
          "/api/dashboard/users/online",
          {
            method: "POST",
            cache: "no-store",
          },
        );

        // Ambil daftar user online.
        const response = await fetch(
          "/api/dashboard/users/online",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        // Server menolak (mis. sesi habis) -> dianggap error.
        if (!response.ok) {
          throw new Error(
            `Request gagal: ${response.status}`,
          );
        }

        const data: {
          users: OnlineUser[];
        } = await response.json();

        setUsers(data.users);
      } catch (error) {
        console.error(
          "ONLINE_USERS_ERROR:",
          error,
        );
      } finally {
        setLoading(false);
      }
    }, []);

  // Jalankan refresh saat tampil, lalu berulang tiap 20 detik.
  useEffect(() => {
    // Refresh pertama dijalankan segera setelah komponen tampil.
    const timeoutId = window.setTimeout(() => {
      void refreshOnlineStatus();
    }, 0);

    // Refresh berkala, hanya saat tab sedang terlihat (hemat request).
    const intervalId = window.setInterval(() => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refreshOnlineStatus();
      }
    }, REFRESH_INTERVAL);

    // Saat user kembali ke tab ini, langsung refresh.
    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void refreshOnlineStatus();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    // Bersihkan timer dan listener saat komponen dilepas.
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [refreshOnlineStatus]);

  // User yang fotonya ditampilkan.
  const visibleUsers = users.slice(
    0,
    MAX_VISIBLE_USERS,
  );

  // Jumlah user yang tidak muat (ditampilkan sebagai "+N").
  const remainingUsers = Math.max(
    users.length - MAX_VISIBLE_USERS,
    0,
  );

  // Tampilan sementara saat data pertama dimuat.
  if (loading && users.length === 0) {
    return (
      <div
        className="flex items-center"
        aria-label="Memuat user online"
      >
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
      </div>
    );
  }

  // Tidak ada yang online.
  if (users.length === 0) {
    return (
      <div className="flex items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-500 shadow-sm">
          0
        </div>

        <span className="ml-2 text-xs text-slate-500">
          0 online
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <div className="flex items-center">
        {visibleUsers.map(
          (user, index) => {
            // Apakah user ini adalah yang sedang login.
            const isCurrentUser =
              user.id === currentUserId;

            return (
              <div
                key={user.id}
                className={`group relative ${
                  index > 0 ? "-ml-2" : ""
                }`}
                style={{
                  zIndex:
                    visibleUsers.length -
                    index,
                }}
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-sm">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={`Foto profil ${user.name}`}
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-600">
                      {getInitial(user.name)}
                    </div>
                  )}

                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                </div>

                <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                  <p className="font-semibold">
                    {user.name}
                    {isCurrentUser
                      ? " (Anda)"
                      : ""}
                  </p>

                  <p className="mt-0.5 text-slate-300">
                    {getRoleLabel(user.role)}
                  </p>
                </div>
              </div>
            );
          },
        )}

        {remainingUsers > 0 && (
          <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
            +{remainingUsers}
          </div>
        )}
      </div>

      <div className="ml-2">
        <p className="select-none text-xs font-medium text-slate-500">
          {users.length} online
        </p>
      </div>
    </div>
  );
}
