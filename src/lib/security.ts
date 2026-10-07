import { NextResponse } from "next/server";

export function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
  };
}

export function jsonResponse(
  data: unknown,
  status = 200,
) {
  return NextResponse.json(data, {
    status,
    headers: noStoreHeaders(),
  });
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const requestUrl = new URL(request.url);

  return origin === requestUrl.origin;
}

export function requireSameOrigin(
  request: Request,
) {
  if (!isSameOrigin(request)) {
    return jsonResponse(
      {
        message:
          "Permintaan tidak diizinkan.",
      },
      403,
    );
  }

  return null;
}