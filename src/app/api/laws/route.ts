// ─── متن کامل قوانین (برگرفته از ویکی‌نبشته) — یک‌بار خوانده و کش می‌شود ──────
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: unknown = null;

export async function GET() {
  try {
    if (!cache) {
      const p = path.join(process.cwd(), "data", "laws-full.json");
      cache = JSON.parse(await readFile(p, "utf-8"));
    }
    return NextResponse.json(cache);
  } catch {
    return NextResponse.json({}, { status: 200 }); // نبود فایل = فقط گزیده‌ها
  }
}
