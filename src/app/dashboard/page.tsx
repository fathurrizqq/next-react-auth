import { redirect } from "next/navigation";

import { getSession } from "@/src/lib/session";
import { prisma } from "@/src/lib/prisma";

import DashboardNavbar from "./DashboardNavbar";

export default async function DashboardPage() {
  // =========================================
  // CEK SESSION
  // =========================================

  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // =========================================
  // AMBIL DATA USER DARI DATABASE
  // =========================================

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },

    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
    },
  });

  // =========================================
  // JIKA USER TIDAK DITEMUKAN
  // =========================================

  if (!user) {
    redirect("/login");
  }

  // =========================================
  // RENDER
  // =========================================

  return (
    <main className="min-h-screen bg-slate-100">

      {/* =========================================
          NAVBAR
      ========================================= */}

      <DashboardNavbar user={user} />

      {/* =========================================
          DASHBOARD CONTENT
      ========================================= */}

      <section className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl bg-white p-6 shadow-sm">

          <p className="text-sm text-slate-500">
            Dashboard
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Selamat datang, {user.name}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Ini adalah area utama dashboard.
          </p>

        </div>
      </section>
    </main>
  );
}