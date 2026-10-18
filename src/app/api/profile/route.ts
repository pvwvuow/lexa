// ─── تنظیمات عمومی حساب: ویرایش نام نمایشی، نام کاربری و بیو (پروفایل شخصی) ─────
// استاد/مدیر: نام نمایشی + بیو؛ دانشجو: فقط نام نمایشی (بیو ویژهٔ اساتید است).
// نام کاربری برای همه قابل تغییر است (همان قاعدهٔ ثبت‌نام، یکتا).
// آواتار در مسیر جداگانه /api/profile/avatar مدیریت می‌شود.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toPublic } from "@/lib/auth";
import { validateUsername } from "@/lib/auth-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.trim().slice(0, max);
}

const TAKEN = "این نام کاربری قبلاً گرفته شده؛ یکی دیگر انتخاب کن.";

export async function PATCH(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });

  const data: { displayName?: string | null; bio?: string | null; username?: string } = {};

  if ("displayName" in body) {
    const name = clean(body.displayName, 48);
    // نام نمایشی می‌تواند خالی شود (بازگشت به username)
    data.displayName = name || null;
  }

  if ("bio" in body) {
    if (me.role === "user")
      return NextResponse.json({ error: "معرفی کوتاه ویژهٔ مدرسان است." }, { status: 400 });
    data.bio = clean(body.bio, 320) || null;
  }

  if (typeof body.username === "string") {
    const uname = body.username.trim().replace(/^@+/, "");
    if (uname && uname !== me.username) {
      const bad = validateUsername(uname);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
      const clash = await db.user.findFirst({ where: { username: uname, NOT: { id: me.id } }, select: { id: true } });
      if (clash) return NextResponse.json({ error: TAKEN }, { status: 409 });
      data.username = uname;
    }
  }

  if (!Object.keys(data).length)
    return NextResponse.json({ error: "چیزی برای ذخیره نیست." }, { status: 400 });

  let updated;
  try {
    updated = await db.user.update({
      where: { id: me.id },
      data,
      select: {
        id: true, username: true, role: true, displayName: true,
        bio: true, avatarUrl: true, createdAt: true,
      },
    });
  } catch (e) {
    // رقابت دو درخواست هم‌زمان روی یک نام: قید یکتایی پایگاه داده
    if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ error: TAKEN }, { status: 409 });
    return NextResponse.json({ error: "ذخیره ناموفق بود." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user: toPublic({
      id: updated.id,
      username: updated.username,
      role: updated.role as "user" | "admin" | "teacher",
      displayName: updated.displayName ?? null,
      bio: updated.bio ?? null,
      avatarUrl: updated.avatarUrl ?? null,
      createdAt: updated.createdAt.toISOString(),
      sessionId: me.sessionId,
    }),
  });
}
