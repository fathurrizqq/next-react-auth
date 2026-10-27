// rate-limit.ts
// Pembatas jumlah percobaan (rate limit) agar login, OTP, dll. tidak bisa di-brute force / di-spam.

// Catatan satu kunci: jumlah percobaan dan kapan hitungan direset.
type RateLimitRecord = {
  count: number;
  resetAt: number;
};

// Penyimpanan di memori: kunci -> catatan.
const store = new Map<string, RateLimitRecord>();

// Bersihkan record kadaluarsa secara periodik agar Map tidak membengkak terus.
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (record.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

cleanupInterval.unref?.();

// Hasil pengecekan batas.
type RateLimitResult = {
  // true = masih boleh, false = sudah melewati batas.
  success: boolean;
  // Sisa percobaan pada jendela waktu ini.
  remaining: number;
  resetAt: number;
};

/**
 * Rate limiter sederhana berbasis memory (per instance).
 *
 * CATATAN PRODUKSI:
 * Implementasi ini HANYA cocok untuk single-instance server (misal 1 pod/1 VM).
 * Di environment serverless atau multi-instance (Vercel, beberapa pod di belakang
 * load balancer), setiap instance punya memory sendiri sehingga limit efektif
 * jadi "limit x jumlah instance" — tidak benar-benar aman dari brute force skala
 * besar. Untuk produksi, ganti dengan Redis/Upstash (@upstash/ratelimit) atau
 * limiter berbasis database supaya counter dibagi antar instance.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const record = store.get(key);

  // Belum ada catatan, atau jendela waktu sudah lewat -> mulai hitungan baru.
  if (!record || record.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  // Sudah mencapai batas -> tolak.
  if (record.count >= limit) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }

  // Masih di bawah batas -> tambah hitungan.
  record.count += 1;

  return {
    success: true,
    remaining: limit - record.count,
    resetAt: record.resetAt,
  };
}

// Ambil IP pengunjung dari header proxy (x-forwarded-for / x-real-ip).
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    // Formatnya "ip-asli, proxy1, proxy2" -> ambil yang pertama.
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp;
  }

  // IP tidak diketahui (mis. saat development tanpa proxy).
  return "unknown";
}