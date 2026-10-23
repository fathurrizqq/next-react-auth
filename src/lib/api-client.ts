export type ApiResult = {
  ok: boolean;
  status: number;
  message: string;
};

type ApiBody = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function postJson(
  url: string,
  body: unknown,
): Promise<ApiResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data: ApiBody = await response.json().catch(() => ({}));

    const fieldError = data.errors
      ? Object.values(data.errors).flat()[0]
      : undefined;

    return {
      ok: response.ok,
      status: response.status,
      message:
        fieldError ??
        data.message ??
        (response.ok ? "Berhasil." : "Terjadi kesalahan."),
    };
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Tidak dapat terhubung ke server.",
    };
  }
}