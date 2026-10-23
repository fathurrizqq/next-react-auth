"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { getRoleLabel } from "@/src/lib/roles";

import OnlineUsers from "./OnlineUsers";
import ProfileModal from "@/src/app/dashboard/profile/ProfileModel";

type DashboardNavbarProps = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
  };
};

export default function DashboardNavbar({ user }: DashboardNavbarProps) {
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout gagal");
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("LOGOUT_ERROR:", error);
      setLoggingOut(false);
    }
  }

  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-6">
          <button
            type="button"
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-slate-50"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200">
              <Image
                src={user.avatar ?? "/default-avatar.svg"}
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

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate">{user.email}</span>
                <span className="text-slate-300">|</span>
                <span className="shrink-0">{getRoleLabel(user.role)}</span>
              </div>
            </div>
          </button>

          <OnlineUsers currentUserId={user.id} />

          <div className="flex items-center gap-2">
            {user.role === "SUPER_ADMIN" && (
              <button
                type="button"
                onClick={() => router.push("/dashboard/users")}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                User Management
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loggingOut ? "Logout..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
}