import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** جزئیات کامل داده‌های یک کاربر — فقط برای مدیر؛ هیچ مسیر حذفی وجود ندارد */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const me = await getSessionUser();
  if (!me)
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "admin")
    return NextResponse.json({ error: "دسترسی ویژهٔ مدیر است." }, { status: 403 });

  const { userId } = await params;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });
    if (!user)
      return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });

    const [lessonStates, attempts, activityDays, notes, blob] = await Promise.all([
      db.lessonState.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 800,
      }),
      db.quizAttempt.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }],
        take: 500,
      }),
      db.activityDay.findMany({
        where: { userId },
        orderBy: { day: "asc" },
        take: 400,
        select: { day: true },
      }),
      db.note.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 300 }),
      db.userBlob.findUnique({ where: { userId } }),
    ]);

    let customCoursesCount = 0;
    let customCoursesTitles: string[] = [];
    if (blob) {
      try {
        const arr = JSON.parse(blob.customCoursesJson) as unknown[];
        customCoursesCount = arr.length;
        customCoursesTitles = arr
          .map((c) => (c as { title?: string })?.title?.trim() ?? "")
          .filter(Boolean)
          .slice(0, 30);
      } catch {}
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role === "admin" ? "admin" : "user",
        createdAt: user.createdAt.toISOString(),
        lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      },
      lessonStates: lessonStates.map((ls) => ({
        lessonId: ls.lessonId,
        status: ls.status,
        sectionsSeen: ls.sectionsSeen,
        quizBest: ls.quizBest,
        markedReview: ls.markedReview,
        updatedAt: ls.updatedAt.toISOString(),
      })),
      quizAttempts: attempts.map((a) => ({
        id: a.id,
        lessonId: a.lessonId,
        date: a.date,
        score: a.score,
        createdAt: a.createdAt.toISOString(),
      })),
      activityDays: activityDays.map((d) => d.day),
      notes: notes.map((n) => ({
        id: n.id,
        lessonId: n.lessonId,
        text: n.text.length > 240 ? n.text.slice(0, 240) + "…" : n.text,
        createdAt: n.createdAt.getTime(),
      })),
      customCoursesCount,
      customCoursesTitles,
    });
  } catch (e) {
    console.error("[admin-user-detail] error:", e);
    return NextResponse.json({ error: "خطا در خواندن جزئیات." }, { status: 500 });
  }
}
