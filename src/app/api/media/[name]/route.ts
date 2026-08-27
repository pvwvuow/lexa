// ─── سرو فایل‌های رسانه‌ای آپلودشده (در حال حاضر فقط آواتارها) ─────────────────
// نام فایل سخت‌گیرانه اعتبارسنجی می‌شود تا خروج از پوشه ممکن نباشد.
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = path.join(process.cwd(), "data", "uploads", "avatars");

const EXT_TYPE: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = await params;
  let name = rawName;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
  // فقط نام ساده — هیچ اسلش یا نقطهٔ مخربی مجاز نیست
  if (!/^[\w-]+\.(png|jpg|jpeg|webp|gif)$/i.test(name))
    return new NextResponse("not found", { status: 404 });

  try {
    const buf = await readFile(path.join(BASE, name));
    const ext = (name.split(".").pop() ?? "").toLowerCase();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": EXT_TYPE[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
