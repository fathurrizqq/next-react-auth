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

  async function handleLogout() {
    try {
      setLoading(true);

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

      setLoading(false);
    }
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-6">
        <div>
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
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Logout..." : "Logout"}
        </button>
      </div>
    </header>
  );
}