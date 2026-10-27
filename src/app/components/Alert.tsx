// Alert.tsx
// Kotak pesan kecil: merah untuk error, hijau untuk sukses.

import type { ReactNode } from "react";

// type: jenis pesan. children: isi pesannya.
type AlertProps = {
  type: "error" | "success";
  children: ReactNode;
};

// Menampilkan pesan dengan warna sesuai jenisnya.
export default function Alert({ type, children }: AlertProps) {
  // Warna kotak sesuai jenis pesan.
  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-600"
      : "border-green-200 bg-green-50 text-green-700";

  return (
    <div
      // "alert" dibacakan langsung oleh screen reader (untuk error); "status" untuk pesan biasa.
      role={type === "error" ? "alert" : "status"}
      className={`rounded-lg border p-3 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}