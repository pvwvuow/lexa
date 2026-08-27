import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** برگرداندن کل داده‌های ذخیره‌شدهٔ کاربر جاری از پایگاه داده */
export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  try {
    const [lessonStates, attempts, activityDays, notes, blob, hiddenBuiltins] = await Promise.all([
      db.lessonState.findMany({ where: { userId: user.id } }),
      db.quizAttempt.findMany({
        where: { userId: user.id },
        orderBy: [{ date: "asc" }],
        take: 5000,
      }),
      db.activityDay.findMany({ where: { userId: user.id }, select: { day: true } }),
      db.note.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 2000 }),
      db.userBlob.findUnique({ where: { userId: user.id } }),
      db.builtinHidden.findMany({ where: { userId: user.id }, select: { courseId: true } }),
    ]);

    const progress: Record<string, unknown> = {};
    const seenIds = new Set<string>();
    for (const ls of lessonStates) {
      const entry: Record<string, unknown> = {
        status: ls.status,
        sectionsSeen: ls.sectionsSeen,
        quizAttempts: [],
      };
      if (ls.quizBest != null) entry.quizBest = ls.quizBest;
      if (ls.markedReview) entry.markedReview = true;
      progress[ls.lessonId] = entry;
      seenIds.add(ls.lessonId);
    }

    // تاریخچهٔ تست‌ها به درون همین نقشه تزریق می‌شود
    const parsedAttempts: { lessonId: string; date: string; score: number }[] = [];
    for (const a of attempts) {
      parsedAttempts.push({ lessonId: a.lessonId, date: a.date, score: a.score });
      const key = seenIds.has(a.lessonId) ? a.lessonId : a.lessonId;
      const entry = (progress[key] ??= {
        status: "in-progress",
        sectionsSeen: 8,
        quizAttempts: [],
      }) as Record<string, unknown>;
      ((entry.quizAttempts as { date: string; score: number }[]) ?? []).push({
        date: a.date,
        score: a.score,
      });
    }

    const notesMap: Record<string, { id: string; text: string; quote?: string; createdAt: number }[]> = {};
    for (const n of notes) {
      (notesMap[n.lessonId] ??= []).push({
        id: n.id,
        text: n.text,
        quote: n.quote || undefined,
        createdAt: n.createdAt.getTime(),
      });
    }

    let customCourses: unknown[] = [];
    let lastLocation: Record<string, unknown> = {};
    let streak: Record<string, unknown> = {};
    if (blob) {
      try { customCourses = JSON.parse(blob.customCoursesJson); } catch {}
      try { lastLocation = JSON.parse(blob.lastLocationJson); } catch {}
      try { streak = JSON.parse(blob.streakJson); } catch {}
    }

    return NextResponse.json({
      snapshot: {
        progress,
        activity: activityDays.map((d) => d.day),
        notes: notesMap,
        customCourses,
        lastLocation,
        streak,
        hiddenBuiltins: hiddenBuiltins.map((h) => h.courseId),
      },
    });
  } catch (e) {
    console.error("[user-data] error:", e);
    return NextResponse.json({ error: "خطا در خواندن داده‌ها." }, { status: 500 });
  }
}
