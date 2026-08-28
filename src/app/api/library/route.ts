import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { teacherCourseToCourse } from "@/lib/social-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** شناسهٔ مجاز برای دورهٔ داخلی اپ (دوره‌های پیش‌فرض خودمان) */
const BUILTIN_ID_RX = /^[a-z0-9][a-z0-9-]{1,39}$/i;

/** کتابخانهٔ من: دوره‌های اساتیدی که به عنوان کتاب افزوده‌ام — به شکل Course آماده
 *  + فهرست دوره‌های داخلی که کاربر از کتابخانه حذف کرده است */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ids: [], courses: [], hiddenBuiltins: [] });

  const [entries, hidden] = await Promise.all([
    db.libraryEntry.findMany({
      where: { userId: me.id },
      orderBy: { addedAt: "desc" },
      include: {
        course: {
          include: { teacher: { select: { id: true, username: true, displayName: true } } },
        },
      },
    }),
    db.builtinHidden.findMany({ where: { userId: me.id }, select: { courseId: true } }),
  ]);

  const courses = entries.map((e) =>
    teacherCourseToCourse(e.course, {
      id: e.course.teacher.id,
      username: e.course.teacher.username,
      displayName: e.course.teacher.displayName || e.course.teacher.username,
    }),
  );

  return NextResponse.json({
    ids: entries.map((e) => e.courseId),
    courses,
    hiddenBuiltins: hidden.map((h) => h.courseId),
  });
}

/**
 * دو عملیات با یک نقطهٔ تماس:
 * ۱) بدنهٔ معمولی {courseId} → افزودن/حذف (توگل) دورهٔ استاد از کتابخانه — نیازمند حساب
 * ۲) بدنهٔ {kind:"builtin", courseId} → توگل حذفِ یک دورهٔ داخلی (پیش‌فرض در کتابخانه است؛
 *    اینجا «حذف» یعنی رکورد پنهان‌سازی، و «افزودن دوباره» یعنی پاک شدن همان رکورد.
 *    پیشرفت، تست و یادداشت آن جلسات دست‌نخورده در جداول خود می‌ماند.)
 */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "برای افزودن به کتابخانه، ابتدا وارد شوید." }, { status: 401 });

  let body: { courseId?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const courseId = String(body.courseId ?? "");
  const kind = body.kind === "builtin" ? "builtin" : "teacher";
  if (!courseId || !BUILTIN_ID_RX.test(courseId))
    return NextResponse.json({ error: "شناسهٔ دوره لازم است." }, { status: 400 });

  // ── دورهٔ داخلی اپ: توگل پنهان‌سازی از کتابخانه ──
  if (kind === "builtin") {
    const existing = await db.builtinHidden.findUnique({
      where: { userId_courseId: { userId: me.id, courseId } },
      select: { id: true },
    });
    if (existing) {
      // افزودن دوباره به کتابخانه — تمام پیشرفتِ ذخیره‌شده بی‌درنگ دیده می‌شود
      await db.builtinHidden.delete({ where: { id: existing.id } });
      return NextResponse.json({ ok: true, inLibrary: true });
    }
    await db.builtinHidden.create({ data: { userId: me.id, courseId } });
    return NextResponse.json({ ok: true, inLibrary: false });
  }

  // ── دورهٔ استاد: همان رفتار قبلی ──
  const course = await db.teacherCourse.findUnique({
    where: { id: courseId },
    select: { id: true, teacherId: true, status: true },
  });
  if (!course) return NextResponse.json({ error: "دوره یافت نشد." }, { status: 404 });
  // پیش‌نویس فقط برای خود استاد در اتاقش دیده می‌شود و افزودنی نیست
  if (course.status === "draft" && !(me && (me.id === course.teacherId || me.role === "admin")))
    return NextResponse.json({ error: "این دوره هنوز منتشر نشده است." }, { status: 403 });

  const existing = await db.libraryEntry.findUnique({
    where: { userId_courseId: { userId: me.id, courseId } },
  });
  if (existing) {
    await db.libraryEntry.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, inLibrary: false });
  }
  await db.libraryEntry.create({ data: { userId: me.id, courseId } });
  return NextResponse.json({ ok: true, inLibrary: true });
}
