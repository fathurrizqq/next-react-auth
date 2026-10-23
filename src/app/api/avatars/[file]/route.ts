import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { AVATAR_DIR } from "@/src/lib/avatar";

const FILE_PATTERN =
  /^[0-9a-f-]{36}-[0-9a-f-]{36}\.(jpg|png|webp)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type RouteContext = {
  params: Promise<{ file: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { file } = await context.params;

  const match = FILE_PATTERN.exec(file);

  if (!match) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const data = await readFile(path.join(AVATAR_DIR, file));

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[match[1]],
        "X-Content-Type-Options": "nosniff",
        // Nama file unik per upload, aman di-cache lama.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}