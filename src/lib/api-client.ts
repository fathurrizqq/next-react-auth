// api-client.ts
// Helper untuk halaman (sisi browser) yang memanggil API dengan POST JSON,
// lalu mengubah hasilnya menjadi satu pesan yang siap ditampilkan ke user.

// Hasil ringkas dari satu panggilan API.
export type ApiResult = {
  // true jika status HTTP 2xx (berhasil).
  ok: boolean;
  // Kode HTTP dari server (0 = gagal terhubung ke server).
  status: number;
  // Pesan yang siap ditampilkan ke user.
  message: string;
};

// Bentuk body JSON yang dikirim API kita (pesan + error per field).
type ApiBody = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

// Kirim POST berisi JSON ke `url`.
// Tidak pernah melempar error: kegagalan jaringan diubah menjadi ApiResult dengan ok = false.
export async function postJson(
  url: string,
  body: unknown,
): Promise<ApiResult> {
  try {
    // Kirim request ke server.
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Baca body JSON; kalau bukan JSON, pakai objek kosong.
    const data: ApiBody = await response.json().catch(() => ({}));

    // Ambil pesan error field pertama (mis. "Nama minimal 4 karakter.") bila ada.
    const fieldError = data.errors
      ? Object.values(data.errors).flat()[0]
      : undefined;

    // Urutan prioritas pesan: error field -> pesan dari server -> pesan bawaan.
    return {
      ok: response.ok,
      status: response.status,
      message:
        fieldError ??
        data.message ??
        (response.ok ? "Berhasil." : "Terjadi kesalahan."),
    };
  // Gagal terhubung (server mati / tidak ada internet).
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Tidak dapat terhubung ke server.",
    };
  }
}