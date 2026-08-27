import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { teacherCourseToCourse } from "@/lib/social-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** کتابخانهٔ من: دوره‌های اساتیدی که به عنوان کتاب افزوده‌ام — به شکل Course آماده */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ ids: [], courses: [] });

  const entries = await db.libraryEntry.findMany({
    where: { userId: me.id },
    orderBy: { addedAt: "desc" },
    include: {
      course: {
        include: { teacher: { select: { id: true, username: true, displayName: true } } },
      },
    },
  });

  const courses = entries.map((e) =>
    teacherCourseToCourse(e.course, {
      id: e.course.teacher.id,
      username: e.course.teacher.username,
      displayName: e.course.teacher.displayName || e.course.teacher.username,
    }),
  );

  return NextResponse.json({ ids: entries.map((e) => e.courseId), courses });
}

/** افزودن / حذف (توگل) یک دوره از کتابخانهٔ من — نیازمند حساب */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "برای افزودن به کتابخانه، ابتدا وارد شوید." }, { status: 401 });

  let body: { courseId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  const courseId = String(body.courseId ?? "");
  if (!courseId) return NextResponse.json({ error: "شناسهٔ دوره لازم است." }, { status: 400 });

  const course = await db.teacherCourse.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "دوره یافت نشد." }, { status: 404 });

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
