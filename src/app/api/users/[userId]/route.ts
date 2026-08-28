// ─── پروفایل عمومی استاد — فعالیت، دوره‌ها و مطالب او ──────────────────────────
// با کلیک روی آواتار/نام استاد در خانه یا فید باز می‌شود.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { teacherCourseToCourse } from "@/lib/social-shared";
import { ratingsAggMany, type RatingAgg } from "@/lib/ratings-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const me = await getSessionUser();

  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, username: true, displayName: true, bio: true,
      avatarUrl: true, role: true, createdAt: true,
      _count: { select: { followers: true, posts: true, teacherCourses: true } },
    },
  });
  if (!u || (u.role !== "teacher" && u.role !== "admin"))
    return NextResponse.json({ error: "پروفایل یافت نشد." }, { status: 404 });

  // دوره‌های عمومی او (پیش‌نویس فقط برای خودش دیده می‌شود)
  const isOwner = !!me && me.id === u.id;
  const courseRows = await db.teacherCourse.findMany({
    where: {
      teacherId: u.id,
      ...(isOwner ? {} : { status: { not: "draft" } }),
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    include: { _count: { select: { libraryEntries: true } } },
  });

  const postRows = await db.post.findMany({
    where: { authorId: u.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { _count: { select: { comments: true } } },
  });

  const [cAgg, pAgg] = await Promise.all([
    ratingsAggMany("tcourse", courseRows.map((c) => c.id)),
    ratingsAggMany("post", postRows.map((p) => p.id)),
  ]);

  let inLibIds = new Set<string>();
  let isFollowing = false;
  if (me) {
    const [lib, fl] = await Promise.all([
      db.libraryEntry.findMany({ where: { userId: me.id }, select: { courseId: true } }),
      db.follow.findUnique({
        where: { studentId_teacherId: { studentId: me.id, teacherId: u.id } },
        select: { id: true },
      }),
    ]);
    inLibIds = new Set(lib.map((e) => e.courseId));
    isFollowing = !!fl;
  }

  const author = {
    id: u.id, username: u.username,
    displayName: u.displayName || u.username, avatarUrl: u.avatarUrl,
  };

  return NextResponse.json({
    profile: {
      id: u.id,
      username: u.username,
      displayName: u.displayName || u.username,
      bio: u.bio ?? "",
      avatarUrl: u.avatarUrl,
      role: u.role,
      joinedAt: u.createdAt.toISOString(),
      followersCount: u._count.followers,
      postsCount: u._count.posts,
      coursesCount: u._count.teacherCourses,
      avgRating:
        [...pAgg.values(), ...cAgg.values()].filter((a) => a.count > 0).length
          ? Math.round(
              ([...pAgg.values(), ...cAgg.values()]
                .reduce((s, a) => s + a.avg * a.count, 0) /
                Math.max(
                  1,
                  [...pAgg.values(), ...cAgg.values()].reduce((s, a) => s + a.count, 0),
                )) *
                10,
            ) / 10
          : 0,
      isFollowing,
    },
    courses: courseRows.map((r) => ({
      ...teacherCourseToCourse(r, author),
      lessonsCount: (JSON.parse(r.chaptersJson) as { lessons?: unknown[] }[]).reduce(
        (n, c) => n + (Array.isArray(c?.lessons) ? c.lessons.length : 0), 0),
      studentsCount: r._count.libraryEntries,
      inLibrary: inLibIds.has(r.id),
      canManage: isOwner || (!!me && me.role === "admin"),
      rating: cAgg.get(r.id) ?? ({ avg: 0, count: 0 } as RatingAgg),
    })),
    posts: postRows.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      tags: p.tags,
      category: p.category,
      thumbnail: p.thumbnail,
      createdAt: p.createdAt.toISOString(),
      // مبنای تشخیص «به‌روز شده» نسخهٔ آفلاین در پروفایل استاد
      updatedAt: p.updatedAt.toISOString(),
      commentsCount: p._count.comments,
      rating: pAgg.get(p.id) ?? ({ avg: 0, count: 0 } as RatingAgg),
    })),
  });
}
