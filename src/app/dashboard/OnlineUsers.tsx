"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

type OnlineUser = {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  lastSeen: string | null;
};

type OnlineUsersProps = {
  currentUserId: string;
};

const MAX_VISIBLE_USERS = 5;
const REFRESH_INTERVAL = 20_000;

const roleLabels: Record<string, string> = {
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super Admin",
  USER: "User",
};

function getInitial(name: string) {
  return (
    name
      .trim()
      .charAt(0)
      .toUpperCase() || "?"
  );
}

function getRoleLabel(role: string) {
  return roleLabels[role] ?? role;
}

export default function OnlineUsers({
  currentUserId,
}: OnlineUsersProps) {
  const [users, setUsers] = useState<OnlineUser[]>(
    [],
  );

  const [loading, setLoading] =
    useState(true);

  /**
   * Mengirim heartbeat ke server.
   */
  const sendHeartbeat = useCallback(
    async () => {
      try {
        const response = await fetch(
          "/api/dashboard/users/online",
          {
            method: "POST",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          console.error(
            "Heartbeat gagal:",
            response.status,
          );
        }
      } catch (error) {
        console.error(
          "ONLINE_HEARTBEAT_ERROR:",
          error,
        );
      }
    },
    [],
  );

  /**
   * Mengambil user yang sedang online.
   */
  const fetchOnlineUsers =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/dashboard/users/online",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Request gagal dengan status ${response.status}`,
          );
        }

        const data: {
          users: OnlineUser[];
        } = await response.json();

        setUsers(data.users);
      } catch (error) {
        console.error(
          "FETCH_ONLINE_USERS_ERROR:",
          error,
        );
      } finally {
        setLoading(false);
      }
    }, []);

  /**
   * Update heartbeat lalu mengambil
   * daftar user online terbaru.
   */
  const refreshOnlineStatus =
    useCallback(async () => {
      await sendHeartbeat();
      await fetchOnlineUsers();
    }, [
      sendHeartbeat,
      fetchOnlineUsers,
    ]);

  useEffect(() => {
    let intervalId:
      | ReturnType<typeof setInterval>
      | null = null;

    /**
     * Jalankan pertama kali.
     */
    async function initialize() {
      await refreshOnlineStatus();
    }

    initialize();

    /**
     * Heartbeat setiap 20 detik.
     */
    intervalId = setInterval(() => {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshOnlineStatus();
      }
    }, REFRESH_INTERVAL);

    /**
     * Jika user kembali ke tab,
     * langsung refresh status.
     */
    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshOnlineStatus();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    /**
     * Cleanup.
     */
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [refreshOnlineStatus]);

  /**
   * Maksimal 5 avatar.
   */
  const visibleUsers = users.slice(
    0,
    MAX_VISIBLE_USERS,
  );

  /**
   * Jumlah user yang tidak ditampilkan.
   */
  const remainingUsers = Math.max(
    users.length - MAX_VISIBLE_USERS,
    0,
  );

  /**
   * Loading.
   */
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

  /**
   * Tidak ada user online.
   */
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
      {/* AVATAR USER ONLINE */}
      <div className="flex items-center">
        {visibleUsers.map(
          (user, index) => {
            const isCurrentUser =
              user.id === currentUserId;

            return (
              <div
                key={user.id}
                className={`group relative ${
                  index > 0
                    ? "-ml-2"
                    : ""
                }`}
                style={{
                  zIndex:
                    visibleUsers.length -
                    index,
                }}
              >
                {/* Avatar */}
                <div
                  className="
                    relative
                    h-8
                    w-8
                    overflow-hidden
                    rounded-full
                    border-2
                    border-white
                    bg-slate-200
                    shadow-sm
                  "
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={`Foto profil ${user.name}`}
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="
                        flex
                        h-full
                        w-full
                        items-center
                        justify-center
                        text-xs
                        font-bold
                        text-slate-600
                      "
                    >
                      {getInitial(
                        user.name,
                      )}
                    </div>
                  )}

                  {/* ONLINE INDICATOR */}
                  <span
                    className="
                      absolute
                      bottom-0
                      right-0
                      h-2.5
                      w-2.5
                      rounded-full
                      border-2
                      border-white
                      bg-emerald-500
                    "
                  />
                </div>

                {/* TOOLTIP */}
                <div
                  className="
                    pointer-events-none
                    absolute
                    left-1/2
                    top-full
                    z-50
                    mt-2
                    hidden
                    -translate-x-1/2
                    whitespace-nowrap
                    rounded-lg
                    bg-slate-900
                    px-3
                    py-2
                    text-xs
                    text-white
                    shadow-lg
                    group-hover:block
                  "
                >
                  <p className="font-semibold">
                    {user.name}

                    {isCurrentUser
                      ? " (Anda)"
                      : ""}
                  </p>

                  <p className="mt-0.5 text-slate-300">
                    {getRoleLabel(
                      user.role,
                    )}
                  </p>
                </div>
              </div>
            );
          },
        )}

        {/* USER LAIN YANG TIDAK DITAMPILKAN */}
        {remainingUsers > 0 && (
          <div
            className="
              -ml-2
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              border-2
              border-white
              bg-slate-200
              text-xs
              font-semibold
              text-slate-600
              shadow-sm
            "
          >
            +{remainingUsers}
          </div>
        )}
      </div>

      {/* JUMLAH ONLINE */}
      <div className="ml-2">
        <p className="select-none text-xs font-medium text-slate-500">
          {users.length} online
        </p>
      </div>
    </div>
  );
}