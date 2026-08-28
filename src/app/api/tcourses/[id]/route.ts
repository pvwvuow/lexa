import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { teacherCourseToCourse } from "@/lib/social-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** جزئیات کامل یک دورهٔ استاد به شکل Course موتور مطالعه */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionUser();

  const row = await db.teacherCourse.findUnique({
    where: { id },
    include: { teacher: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });
  if (!row) return NextResponse.json({ error: "دوره یافت نشد." }, { status: 404 });

  // پیش‌نویس/در حال آماده‌سازی فقط برای خودِ نویسنده یا مدیر دیده می‌شود
  const isOwner = !!me && (me.id === row.teacherId || me.role === "admin");
  if (row.status !== "published" && !isOwner)
    return NextResponse.json({ error: "دوره یافت نشد." }, { status: 404 });

  const course = teacherCourseToCourse(row, {
    id: row.teacher.id,
    username: row.teacher.username,
    displayName: row.teacher.displayName || row.teacher.username,
    avatarUrl: row.teacher.avatarUrl,
  });

  return NextResponse.json({
    course,
    teacher: {
      id: row.teacher.id,
      username: row.teacher.username,
      displayName: row.teacher.displayName || row.teacher.username,
      avatarUrl: row.teacher.avatarUrl,
    },
    canManage: !!me && (me.id === row.teacherId || me.role === "admin"),
  });
}

/** حذف دوره — نویسنده یا مدیر */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const row = await db.teacherCourse.findUnique({ where: { id }, select: { teacherId: true } });
  if (!row) return NextResponse.json({ error: "دوره یافت نشد." }, { status: 404 });
  if (row.teacherId !== me.id && me.role !== "admin")
    return NextResponse.json({ error: "اجازهٔ حذف این دوره را ندارید." }, { status: 403 });

  await db.libraryEntry.deleteMany({ where: { courseId: id } });
  await db.teacherCourse.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
