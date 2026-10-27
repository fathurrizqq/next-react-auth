// dashboard/page.tsx
// Halaman utama dashboard. Hanya bisa dibuka oleh user yang sudah login dan akunnya aktif.
import { redirect } from "next/navigation";

import { getSession } from "@/src/lib/session";
import { prisma } from "@/src/lib/prisma";

import DashboardNavbar from "./DashboardNavbar";

// Halaman ini dirender di server, jadi pengecekan login dilakukan sebelum halaman dikirim.
export default async function DashboardPage() {
  // Ambil sesi dari cookie. null = belum login atau sesi sudah habis.
  const session = await getSession();

  // Belum login -> ke halaman login.
  if (!session) {
    redirect("/login");
  }

  // Ambil data terbaru user dari database (tanpa passwordHash).
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
      isActive: true,
    },
  });

  // Akun sudah dihapus atau dinonaktifkan -> ke halaman login.
  if (!user || !user.isActive) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* Bar atas: profil, user online, menu, dan logout */}
      <DashboardNavbar
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        }}
      />

      {/* Isi halaman */}
      <section className="mx-auto max-w-7xl p-6">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Dashboard</p>

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
