// page.tsx
// Halaman utama (/): langsung diarahkan ke halaman login.

import { redirect } from "next/navigation";

// Redirect dijalankan di server, user tidak melihat halaman kosong.
export default function HomePage() {
  redirect("/login");
}