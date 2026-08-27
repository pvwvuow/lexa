// ─── کتابخانهٔ عمومی: دوره‌ها و مطالب به تفکیک شاخه ───────────────────────────
// شاخه‌ها: تجارت / آیین دادرسی مدنی / آزمون وکالت / دروس تخصصی کارشناسی وکالت /
// سایر. پیش‌نویس‌ها اینجا دیده نمی‌شوند؛ دورهٔ «در حال آماده‌سازی» برچسب دارد و
// قابل افزودن است. مرتب‌سازی: امتیاز بالاتر جلوتر، سپس تازه‌تر.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { CATEGORY_SLUGS, teacherCourseToCourse } from "@/lib/social-shared";
import { ratingsAggMany, feedScore, type RatingAgg } from "@/lib/ratings-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  const catParam = req.nextUrl.searchParams.get("cat") ?? "";
  const cat = CATEGORY_SLUGS.includes(catParam) ? catParam : "";

  const rows = await db.teacherCourse.findMany({
    where:
      cat === "other"
        ? { status: { not: "draft" }, OR: [{ category: "other" }, { category: "" }] }
        : { status: { not: "draft" }, ...(cat ? { category: cat } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 60,
    include: {
      teacher: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { libraryEntries: true } },
    },
  });
  const filtered = rows;

  const courseIds = filtered.map((r) => r.id);
  const [aggMap, libIds] = await Promise.all([
    ratingsAggMany("tcourse", courseIds),
    me
      ? db.libraryEntry
          .findMany({ where: { userId: me.id }, select: { courseId: true } })
          .then((l) => new Set(l.map((e) => e.courseId)))
      : Promise.resolve(new Set<string>()),
  ]);

  const courses = filtered
    .map((r) => {
      const author = {
        id: r.teacher.id,
        username: r.teacher.username,
        displayName: r.teacher.displayName || r.teacher.username,
        avatarUrl: r.teacher.avatarUrl,
      };
      const agg = aggMap.get(r.id) ?? { avg: 0, count: 0 };
      return {
        ...teacherCourseToCourse(r, author),
        teacher: author,
        lessonsCount: (JSON.parse(r.chaptersJson) as { lessons?: unknown[] }[]).reduce(
          (n, c) => n + (Array.isArray(c?.lessons) ? c.lessons.length : 0), 0),
        studentsCount: r._count.libraryEntries,
        inLibrary: libIds.has(r.id),
        canManage: !!me && (me.id === r.teacherId || me.role === "admin"),
        rating: agg,
        score: feedScore(r.updatedAt, agg),
      };
    })
    .sort((a, b) => b.score - a.score);

  // مطالب همان شاخه
  const postRows = await db.post.findMany({
    where:
      cat === "other"
        ? { OR: [{ category: "other" }, { category: "" }] }
        : cat
          ? { category: cat }
          : {},
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { comments: true } },
    },
  });

  const pAgg = await ratingsAggMany("post", postRows.map((p) => p.id));
  const posts = postRows
    .map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      tags: p.tags,
      category: p.category,
      createdAt: p.createdAt.toISOString(),
      commentsCount: p._count.comments,
      rating: pAgg.get(p.id) ?? ({ avg: 0, count: 0 } as RatingAgg),
      author: {
        id: p.author.id,
        username: p.author.username,
        displayName: p.author.displayName || p.author.username,
        avatarUrl: p.author.avatarUrl,
      },
      score: feedScore(p.createdAt, pAgg.get(p.id)),
    }))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ courses, posts });
}
