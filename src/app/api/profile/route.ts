// ─── تنظیمات عمومی حساب: ویرایش نام نمایشی و بیو (پروفایل شخصی) ───────────────
// استاد/مدیر: نام نمایشی + بیو؛ دانشجو: فقط نام نمایشی (بیو ویژهٔ اساتید است).
// آواتار در مسیر جداگانه /api/profile/avatar مدیریت می‌شود.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toPublic } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.trim().slice(0, max);
}

export async function PATCH(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const data: { displayName?: string | null; bio?: string | null } = {};

  if ("displayName" in body) {
    const name = clean(body.displayName, 48);
    // نام نمایشی می‌تواند خالی شود (بازگشت به username)
    data.displayName = name || null;
  }

  if ("bio" in body) {
    if (me.role === "user")
      return NextResponse.json({ error: "معرفی کوتاه ویژهٔ اساتید است." }, { status: 400 });
    data.bio = clean(body.bio, 320) || null;
  }

  if (!Object.keys(data).length)
    return NextResponse.json({ error: "چیزی برای ذخیره نیست." }, { status: 400 });

  const updated = await db.user.update({
    where: { id: me.id },
    data,
    select: {
      id: true, username: true, role: true, displayName: true,
      bio: true, avatarUrl: true, createdAt: true,
    },
  });

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
