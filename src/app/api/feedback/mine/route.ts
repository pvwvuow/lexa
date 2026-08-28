import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** بازخوردهای ثبت‌شدهٔ خود کاربر (برای نمایش وضعیت بررسی مدیر) */
export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me)
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId");

  const rows = await db.lessonFeedback.findMany({
    where: {
      userId: me.id,
      ...(lessonId ? { lessonId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      lessonId: true,
      lessonTitle: true,
      matchPercent: true,
      needsChange: true,
      severity: true,
      status: true,
      adminNote: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}
