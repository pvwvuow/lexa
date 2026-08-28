import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { SyncSnapshot } from "@/lib/auth-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingProgress = {
  status?: string;
  sectionsSeen?: number;
  quizBest?: number;
  markedReview?: boolean;
};

/**
 * ذخیرهٔ ادغامی داده‌های کاربر — سیاست «هرگز پاک نشو»:
 * سرور فقط مقادیر بهتر را می‌پذیرد (تکمیل‌شده بر درحال‌انجام مقدم است،
 * بیشینهٔ بخش‌های دیده‌شده و بهترین نمره حفظ می‌شود) و هیچ ردیفی حذف نمی‌کند.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  let snap: SyncSnapshot;
  try {
    snap = (await req.json()) as SyncSnapshot;
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر." }, { status: 400 });
  }

  try {
    const progress = snap.progress ?? {};
    // ── وضعیت جلسات (ادغام حداکثری: خواندن ← مقایسه ← نوشتن) ──
    for (const [lessonId, raw] of Object.entries(progress)) {
      if (!raw || typeof lessonId !== "string") continue;
      const p = raw as IncomingProgress;
      if (!p.status || !["in-progress", "completed"].includes(p.status)) continue;
      try {
        const existing = await db.lessonState.findUnique({
          where: { userId_lessonId: { userId: user.id, lessonId } },
          select: { status: true, sectionsSeen: true, quizBest: true },
        });
        // قواعد ابدی: تکمیل‌شده هرگز به درحال‌انجام برنمی‌گردد؛
        // بیشینهٔ بخش‌های دیده‌شده و بهترین نمره حفظ می‌شود.
        const nextStatus =
          existing?.status === "completed" || p.status === "completed"
            ? "completed"
            : "in-progress";
        const nextSeen = Math.max(existing?.sectionsSeen ?? 0, p.sectionsSeen ?? 0);
        const nextBest = Math.max(
          existing?.quizBest ?? -1,
          typeof p.quizBest === "number" ? Math.round(p.quizBest) : -1
        );
        await db.lessonState.upsert({
          where: { userId_lessonId: { userId: user.id, lessonId } },
          create: {
            userId: user.id,
            lessonId,
            status: nextStatus,
            sectionsSeen: Math.max(1, Math.min(64, nextSeen || 1)),
            quizBest: nextBest >= 0 ? nextBest : null,
            markedReview: !!p.markedReview,
          },
          update: {
            status: nextStatus,
            sectionsSeen: Math.min(64, nextSeen),
            quizBest: nextBest >= 0 ? nextBest : undefined,
            markedReview: !!p.markedReview || undefined,
          },
        });
      } catch {
        /* یک جلسه نباید بقیه را متوقف کند */
      }
    }

    // ── تاریخچهٔ آزمون‌ها (با صرفه‌جوئی از تکرار) ──
    const attempts =
      snap.quizAttempts?.filter(
        (a) =>
          a &&
          typeof a.lessonId === "string" &&
          typeof a.date === "string" &&
          typeof a.score === "number"
      ) ?? [];
    for (const a of attempts.slice(-2000)) {
      const exists = await db.quizAttempt.findFirst({
        where: { userId: user.id, lessonId: a.lessonId, date: a.date, score: Math.round(a.score) },
        select: { id: true },
      });
      if (!exists) {
        await db.quizAttempt
          .create({
            data: { userId: user.id, lessonId: a.lessonId, date: a.date, score: Math.round(a.score) },
          })
          .catch(() => {});
      }
    }

    // ── روزهای فعالیت ──
    const days = new Set(
      (snap.activity ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    );
    if (days.size) {
      // SQLite از skipDuplicates پشتیبانی نمی‌کند؛ اول موجودها را می‌خوانیم
      const existing = await db.activityDay.findMany({
        where: { userId: user.id, day: { in: [...days] } },
        select: { day: true },
      });
      const have = new Set(existing.map((e) => e.day));
      const fresh = [...days].filter((d) => !have.has(d));
      if (fresh.length) {
        await db.activityDay
          .createMany({ data: fresh.map((day) => ({ userId: user.id, day })) })
          .catch(() => {});
      }
    }

    // ── یادداشت‌ها (فقط افزودنی) ──
    for (const [lessonId, list] of Object.entries(snap.notes ?? {})) {
      if (!Array.isArray(list)) continue;
      for (const n of list) {
        if (!n?.id || typeof n.text !== "string") continue;
        const createdAtMs = Number.isFinite(n.createdAt) ? n.createdAt : Date.now();
        await db.note
          .upsert({
            where: { userId_id: { userId: user.id, id: n.id } },
            create: {
              id: n.id,
              userId: user.id,
              lessonId,
              text: n.text.slice(0, 8000),
              quote: typeof n.quote === "string" ? n.quote.slice(0, 1000) : null,
              createdAt: new Date(Math.min(createdAtMs, Date.now() + 86_400_000)),
            },
            update: {}, // موجود است؟ هیچ تغییری نمی‌کنیم — سابقهٔ سرور مقدس است
          })
          .catch(() => {});
      }
    }

    // ── دوره‌های داخلی حذف‌شده از کتابخانهٔ من (فقط افزودنی؛ برخلاف «هرگز پاک نشو») ──
    const hiddens = (snap.hiddenBuiltins ?? []).filter(
      (c) => typeof c === "string" && /^[a-z0-9][a-z0-9-]{1,39}$/i.test(c)
    );
    if (hiddens.length) {
      const have = await db.builtinHidden.findMany({
        where: { userId: user.id, courseId: { in: [...new Set(hiddens)] } },
        select: { courseId: true },
      });
      const haveSet = new Set(have.map((h) => h.courseId));
      const fresh = [...new Set(hiddens)].filter((cid) => !haveSet.has(cid));
      if (fresh.length)
        await db.builtinHidden
          .createMany({ data: fresh.map((courseId) => ({ userId: user.id, courseId })) })
          .catch(() => {});
    }

    // ── بلاب (کتاب‌های اختصاصی، آخرین مکان، استریک) ──
    let blob = await db.userBlob.findUnique({ where: { userId: user.id } });
    if (!blob) blob = await db.userBlob.create({ data: { userId: user.id } });

    // ادغام کتاب‌های اختصاصی بر اساس شناسه
    let mergedCourses: unknown[] = [];
    try { mergedCourses = JSON.parse(blob.customCoursesJson) as unknown[]; } catch {}
    if (Array.isArray(snap.customCourses)) {
      const ids = new Set(
        mergedCourses.map((c) => (c as { id?: string })?.id).filter(Boolean)
      );
      for (const c of snap.customCourses) {
        const cid = (c as { id?: string })?.id;
        if (cid && !ids.has(cid)) {
          mergedCourses.push(c);
          ids.add(cid);
        }
      }
    }

    // ادغام آخرین مکان و استریک با انتخاب نسخهٔ پراطلاعات‌تر
    let lastLocation = {};
    try { lastLocation = JSON.parse(blob.lastLocationJson); } catch {}
    if (snap.lastLocation && Object.keys(snap.lastLocation).length)
      lastLocation = snap.lastLocation;

    let streakVal: Record<string, unknown> = {};
    try { streakVal = JSON.parse(blob.streakJson); } catch {}
    const incomingCount = Number((snap.streak as { count?: number } | undefined)?.count ?? 0);
    const storedCount = Number((streakVal as { count?: number }).count ?? 0);
    if (incomingCount > storedCount && snap.streak) streakVal = snap.streak;

    await db.userBlob.update({
      where: { userId: user.id },
      data: {
        customCoursesJson: JSON.stringify(mergedCourses).slice(0, 4_000_000),
        lastLocationJson: JSON.stringify(lastLocation),
        streakJson: JSON.stringify(streakVal),
      },
    });

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    console.error("[user-sync] error:", e);
    return NextResponse.json({ error: "خطا در ذخیرهٔ داده‌ها." }, { status: 500 });
  }
}
