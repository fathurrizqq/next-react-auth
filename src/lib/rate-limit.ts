type RateLimitRecord = {
  count: number;
  resetAt: number;
};

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

type RateLimitResult = {
  success: boolean;
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

  if (!record || record.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;

  return {
    success: true,
    remaining: limit - record.count,
    resetAt: record.resetAt,
  };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp;
  }

  return "unknown";
}
