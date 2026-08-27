import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { LIMITS, teacherCourseToCourse } from "@/lib/social-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorOf(u: { id: string; username: string; displayName: string | null }) {
  return { id: u.id, username: u.username, displayName: u.displayName || u.username };
}

/** فهرست دوره‌های اساتید + وضعیت کتابخانهٔ کاربر جاری؛ mine=1 → فقط دورهٔ خودم */
export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  const where = mine && me ? { teacherId: me.id } : {};
  const rows = await db.teacherCourse.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      teacher: { select: { id: true, username: true, displayName: true } },
      _count: { select: { libraryEntries: true } },
    },
  });

  let libIds = new Set<string>();
  if (me) {
    const lib = await db.libraryEntry.findMany({ where: { userId: me.id }, select: { courseId: true } });
    libIds = new Set(lib.map((e) => e.courseId));
  }

  return NextResponse.json({
    courses: rows.map((r) => {
      const author = authorOf(r.teacher);
      return {
        ...teacherCourseToCourse(r, author),
        teacher: author,
        lessonsCount: (JSON.parse(r.chaptersJson) as { lessons?: unknown[] }[]).reduce(
          (n, c) => n + (Array.isArray(c?.lessons) ? c.lessons.length : 0), 0),
        studentsCount: r._count.libraryEntries,
        inLibrary: libIds.has(r.id),
        canManage: !!me && me.id === r.teacherId,
      };
    }),
  });
}

/** ایجاد یا ویرایش دورهٔ استاد — فقط استاد یا مدیر */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "برای ساخت دوره، ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "teacher" && me.role !== "admin")
    return NextResponse.json({ error: "ساخت دوره ویژهٔ اساتید است. از پنل مدیریت درخواست دهید." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim().slice(0, 140);
  if (!title) return NextResponse.json({ error: "عنوان دوره لازم است." }, { status: 400 });

  const chapters = Array.isArray(body.chapters) ? body.chapters.slice(0, LIMITS.chapters) : [];
  if (!chapters.length)
    return NextResponse.json({ error: "دست‌کم یک فصل با یک جلسه لازم است." }, { status: 400 });

  // ماده‌بندی شناسه‌ها روی سرور انجام می‌شود؛ اینجا JSON خام نگه می‌داریم
  const chaptersJson = JSON.stringify(chapters);

  const data = {
    title,
    tagline: String(body.tagline ?? "").trim().slice(0, 160),
    description: String(body.description ?? "").trim().slice(0, 2000),
    icon: String(body.icon ?? "").trim().slice(0, 40),
    accent: ["navy", "bronze", "green"].includes(String(body.accent)) ? String(body.accent) : "bronze",
    chaptersJson,
  };

  const editId = typeof body.id === "string" && body.id ? body.id : null;
  if (editId) {
    const row = await db.teacherCourse.findUnique({ where: { id: editId }, select: { teacherId: true } });
    if (!row) return NextResponse.json({ error: "دوره یافت نشد." }, { status: 404 });
    if (row.teacherId !== me.id && me.role !== "admin")
      return NextResponse.json({ error: "اجازهٔ ویرایش این دوره را ندارید." }, { status: 403 });
    const updated = await db.teacherCourse.update({
      where: { id: editId },
      data: { ...data, publishedAt: new Date() },
    });
    return NextResponse.json({ ok: true, id: updated.id });
  }

  const created = await db.teacherCourse.create({
    data: { ...data, teacherId: me.id, publishedAt: new Date() },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
