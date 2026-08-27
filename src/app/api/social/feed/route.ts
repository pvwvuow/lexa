import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ratingsAggMany, feedScore } from "@/lib/ratings-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * فید مطالب اساتید — اگر کاربر وارد شده و استادی را دنبال می‌کند، فقط
 * مطالب اساتیدی که دنبال می‌کند؛ وگرنه آخرین مطالب همهٔ اساتید.
 * رتبه‌بندی: مطلبِ امتیازِ بالاتر جلوتر، ولی تازگی هم نقش دارد.
 */
export async function GET(req: NextRequest) {
  const me = await getSessionUser();
  const scope = req.nextUrl.searchParams.get("scope") ?? "auto";

  let authorIds: string[] | null = null;
  let followingCount = 0;
  if (me && scope !== "all") {
    const fl = await db.follow.findMany({ where: { studentId: me.id }, select: { teacherId: true } });
    followingCount = fl.length;
    if (fl.length) authorIds = fl.map((f) => f.teacherId);
  }

  const posts = await db.post.findMany({
    where: authorIds ? { authorId: { in: authorIds } } : {},
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { comments: true } },
    },
  });

  const aggMap = await ratingsAggMany("post", posts.map((p) => p.id));

  const mapped = posts.map((p) => {
    const rating = aggMap.get(p.id) ?? { avg: 0, count: 0 };
    return {
      id: p.id,
      title: p.title,
      summary: p.summary,
      tags: p.tags,
      category: p.category,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      commentsCount: p._count.comments,
      rating,
      score: feedScore(p.createdAt, rating),
      author: {
        id: p.author.id,
        username: p.author.username,
        displayName: p.author.displayName || p.author.username,
        avatarUrl: p.author.avatarUrl,
      },
    };
  });

  // امتیاز بالا ⇒ جلوتر؛ بدون امتیاز هم ترتیب زمانی حفظ می‌شود
  mapped.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    followingCount,
    showingAll: !authorIds,
    posts: mapped.slice(0, 12),
  });
}
