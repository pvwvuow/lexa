import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureAdmin, getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** تاریخ ISO به‌تاریخی محلیِ سرور (نه UTC) — «امروز» باید با ساعت ایران بخواند */
function localDayISO(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** فهرست همهٔ کاربران + آمار عملکرد — فقط برای مدیر */
export async function GET() {
  await ensureAdmin();
  const me = await getSessionUser();
  if (!me)
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "admin")
    return NextResponse.json({ error: "دسترسی ویژهٔ مدیر است." }, { status: 403 });

  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });

    // آمار در یک رفت‌وبرگشت برای همهٔ کاربران
    const lessonStates = await db.lessonState.findMany({
      select: { userId: true, status: true, quizBest: true },
    });
    const attempts = await db.quizAttempt.groupBy({
      by: ["userId", "date"],
      _count: { _all: true },
    });
    const activities = await db.activityDay.findMany({ select: { userId: true } });
    const noteCounts = await db.note.groupBy({
      by: ["userId"],
      _count: { _all: true },
    });

    const statsByUser = new Map<
      string,
      { started: number; completed: number; quizzes: number; bestScores: number[]; activityDays: number }
    >();
    for (const u of users)
      statsByUser.set(u.id, { started: 0, completed: 0, quizzes: 0, bestScores: [], activityDays: 0 });

    for (const ls of lessonStates) {
      const s = statsByUser.get(ls.userId);
      if (!s) continue;
      s.started += 1;
      if (ls.status === "completed") s.completed += 1;
      if (typeof ls.quizBest === "number") s.bestScores.push(ls.quizBest);
    }
    for (const g of attempts) {
      const s = statsByUser.get(g.userId);
      if (s) s.quizzes += g._count._all;
    }
    for (const a of activities) {
      const s = statsByUser.get(a.userId);
      if (s) s.activityDays += 1;
    }

    let totalQuizzes = 0;
    for (const s of statsByUser.values()) totalQuizzes += s.quizzes;

    const today = localDayISO(new Date());
    let completions = 0;
    for (const s of statsByUser.values()) completions += s.completed;

    return NextResponse.json({
      users: users.map((u) => {
        const s = statsByUser.get(u.id)!;
        const avgBest =
          s.bestScores.length > 0
            ? Math.round(s.bestScores.reduce((a, b) => a + b, 0) / s.bestScores.length)
            : null;
        return {
          id: u.id,
          username: u.username,
          role: u.role === "admin" ? "admin" : "user",
          createdAt: u.createdAt.toISOString(),
          lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
          onlineNow:
            !!u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < 10 * 60_000,
          activeToday:
            !!u.lastSeenAt && localDayISO(u.lastSeenAt) >= today,
          stats: {
            started: s.started,
            completed: s.completed,
            quizzes: s.quizzes,
            avgBest,
            activityDays: s.activityDays,
            notesCount: noteCounts.find((n) => n.userId === u.id)?._count._all ?? 0,
          },
        };
      }),
      totals: {
        users: users.filter((u) => u.role !== "admin").length,
        admins: users.filter((u) => u.role === "admin").length,
        onlineNow: [...statsByUser.keys()].filter((id) => {
          const u = users.find((x) => x.id === id);
          return !!u?.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < 10 * 60_000;
        }).length,
        completions,
        totalQuizzes,
      },
    });
  } catch (e) {
    console.error("[admin-users] error:", e);
    return NextResponse.json({ error: "خطا در خواندن فهرست." }, { status: 500 });
  }
}
