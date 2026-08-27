import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * پیشنهادهای استاد (مثل پیشنهادهای اینستاگرام): فهرست اساتید با شمار
 * دنبال‌کننده/مطلب/دوره و وضعیت فالوی کاربر جاری.
 */
export async function GET() {
  const me = await getSessionUser();

  const rows = await db.user.findMany({
    where: { role: "teacher" },
    select: {
      id: true, username: true, displayName: true, bio: true,
      _count: { select: { followers: true, posts: true, teacherCourses: true } },
    },
  });

  let followed = new Set<string>();
  if (me) {
    const fl = await db.follow.findMany({ where: { studentId: me.id }, select: { teacherId: true } });
    followed = new Set(fl.map((f) => f.teacherId));
  }

  const teachers = rows
    .map((t) => ({
      id: t.id,
      username: t.username,
      displayName: t.displayName || t.username,
      bio: t.bio ?? "",
      followers: t._count.followers,
      posts: t._count.posts,
      courses: t._count.teacherCourses,
      isFollowing: followed.has(t.id),
    }))
    .sort((a, b) => b.followers - a.followers || b.posts - a.posts)
    .slice(0, 12);

  return NextResponse.json({ teachers });
}
