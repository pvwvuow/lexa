import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { LIMITS, safeCategory, safeCategories, teacherCourseToCourse } from "@/lib/social-shared";
import { ratingsAggMany, feedScore } from "@/lib/ratings-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorOf(u: {
  id: string; username: string; displayName: string | null; avatarUrl?: string | null;
}) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName || u.username,
    avatarUrl: u.avatarUrl ?? null,
  };
}

const TEACHER_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;

/** فهرست دوره‌های اساتید (+ mine فقط دوره‌های خودم)؛ امتیاز بالاتر جلوتر */
export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  const where = mine && me ? { teacherId: me.id } : {};
  const rows = await db.teacherCourse.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 80,
    include: {
      teacher: { select: TEACHER_SELECT },
      _count: { select: { libraryEntries: true } },
    },
  });

  let libIds = new Set<string>();
  if (me) {
    const lib = await db.libraryEntry.findMany({ where: { userId: me.id }, select: { courseId: true } });
    libIds = new Set(lib.map((e) => e.courseId));
  }

  // مخفی کردن پیش‌نویس غیرمالک + تجمیع امتیازها
  const visible = rows.filter(
    (r) => r.status !== "draft" || (!!me && (me.id === r.teacherId || me.role === "admin")),
  );
  const aggMap = await ratingsAggMany("tcourse", visible.map((r) => r.id));

  return NextResponse.json({
    courses: visible
      .map((r) => {
        const author = authorOf(r.teacher);
        const rating = aggMap.get(r.id) ?? { avg: 0, count: 0 };
        return {
          ...teacherCourseToCourse(r, author),
          teacher: author,
          lessonsCount: (JSON.parse(r.chaptersJson) as { lessons?: unknown[] }[]).reduce(
            (n, c) => n + (Array.isArray(c?.lessons) ? c.lessons.length : 0), 0),
          studentsCount: r._count.libraryEntries,
          inLibrary: libIds.has(r.id),
          canManage: !!me && (me.id === r.teacherId || me.role === "admin"),
          rating,
          score: feedScore(r.updatedAt, rating),
        };
      })
      .sort((a, b) => b.score - a.score),
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
    category: safeCategory(body.category),
    categories: JSON.stringify(safeCategories(body.categories ?? body.category)),
    status: ["draft", "prep", "published"].includes(String(body.status)) ? String(body.status) : "published",
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
