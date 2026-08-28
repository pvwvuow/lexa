// ─── آپلود و حذف آواتار — ویژهٔ استاد و مدیر ──────────────────────────────────
// فایل تصویری ≤۲MB در data/uploads/avatars ذخیره می‌شود (مقاوم در برابر بازسازی
// پروژه) و از طریق /api/media/<name> سرو می‌گردد. دانشجو آواتار ندارد.
import { NextRequest, NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads", "avatars");
const MAX_BYTES = 2 * 1024 * 1024; // ۲ مگابایت

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function publicUrl(name: string): string {
  return `/api/media/${encodeURIComponent(name)}`;
}

async function removeFile(fileUrl?: string | null): Promise<void> {
  if (!fileUrl || !fileUrl.startsWith("/api/media/")) return;
  const name = decodeURIComponent(fileUrl.replace("/api/media/", ""));
  if (!/^[\w.-]+$/.test(name)) return;
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}

/** آپلود آواتار جدید — جایگزین قبلی؛ فایل قدیمی پاک می‌شود */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role === "user")
    return NextResponse.json(
      { error: "آپلود آواتار ویژهٔ اساتید است؛ آواتار شما با حرف اول نام ساخته می‌شود." },
      { status: 403 },
    );
  if (!rateLimit(req, `avatar:${me.id}`, 6, 10 * 60_000))
    return NextResponse.json({ error: "تغییر آواتار زیاد بود؛ کمی بعد تلاش کنید." }, { status: 429 });

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
    return NextResponse.json({ error: "حجم تصویر باید کمتر از ۲ مگابایت باشد." }, { status: 400 });
  const ext = MIME_EXT[file.type];
  if (!ext)
    return NextResponse.json({ error: "فرمت PNG، JPEG، WebP یا GIF مجاز است." }, { status: 400 });

  // آواتار مربعیِ سبک: بازخوانی ابعاد لازم نیست؛ مرورگر با object-fit برش می‌زند
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${me.id}-${Date.now().toString(36)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

  const oldUrl = me.avatarUrl;
  await db.user.update({ where: { id: me.id }, data: { avatarUrl: publicUrl(name) } });
  if (oldUrl && oldUrl !== publicUrl(name)) await removeFile(oldUrl);

  return NextResponse.json({ ok: true, avatarUrl: publicUrl(name) });
}

/** برداشتن آواتار — بازگشت به آواتار پیش‌فرض */
export async function DELETE() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role === "user") return NextResponse.json({ error: "آواتار نداری." }, { status: 403 });
  const oldUrl = me.avatarUrl;
  await db.user.update({ where: { id: me.id }, data: { avatarUrl: null } });
  if (oldUrl) await removeFile(oldUrl);
  return NextResponse.json({ ok: true, avatarUrl: null });
}
