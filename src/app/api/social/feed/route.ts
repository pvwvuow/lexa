import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * فید مطالب اساتید — اگر کاربر وارد شده و استادی را دنبال می‌کند، فقط
 * مطالب اساتیدی که دنبال می‌کند؛ وگرنه آخرین مطالب همهٔ اساتید (برای آشنایی).
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
    take: 12,
    include: {
      author: { select: { id: true, username: true, displayName: true, role: true } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json({
    followingCount,
    showingAll: !authorIds,
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      tags: p.tags,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      commentsCount: p._count.comments,
      author: { id: p.author.id, username: p.author.username, displayName: p.author.displayName || p.author.username },
    })),
  });
}
