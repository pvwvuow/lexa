// ─── آپلود تصویر شاخص (کاور) مطلب یا دوره — ویژهٔ استاد و مدیر ────────────────
// فایل تصویری ≤۴MB در data/uploads/covers ذخیره می‌شود و از /api/cover/<name>
// سرو می‌گردد. تصویر شاخص دلخواه است؛ استاد می‌تواند به‌جای آپلود فقط لینک بدهد.
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads", "covers");
const MAX_BYTES = 4 * 1024 * 1024; // ۴ مگابایت

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "teacher" && me.role !== "admin")
    return NextResponse.json({ error: "آپلود تصویر ویژهٔ اساتید است." }, { status: 403 });
  if (!rateLimit(req, `cover:${me.id}`, 12, 10 * 60_000))
    return NextResponse.json({ error: "آپلودها زیاد بود؛ کمی بعد تلاش کنید." }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "فایلی انتخاب نشده است." }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "حجم تصویر باید کمتر از ۴ مگابایت باشد." }, { status: 400 });
  const ext = MIME_EXT[file.type];
  if (!ext)
    return NextResponse.json({ error: "فرمت PNG، JPEG یا WebP مجاز است." }, { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${me.id}-${Date.now().toString(36)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ ok: true, url: `/api/cover/${encodeURIComponent(name)}` });
}
