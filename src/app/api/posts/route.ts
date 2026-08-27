import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sanitizeSections } from "@/lib/social-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ایجاد مطلب جدید — فقط استاد یا مدیر */
export async function POST(req: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "برای انتشار مطلب، ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "teacher" && me.role !== "admin")
    return NextResponse.json({ error: "انتشار مطلب ویژهٔ اساتید است." }, { status: 403 });

  let body: { title?: string; summary?: string; tags?: string; blocks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const title = (body.title ?? "").trim().slice(0, 140);
  if (!title) return NextResponse.json({ error: "عنوان مطلب را بنویسید." }, { status: 400 });
  const sections = sanitizeSections(body.blocks);
  if (!sections.length)
    return NextResponse.json({ error: "دست‌کم یک بلوک محتوا لازم است." }, { status: 400 });

  const p = await db.post.create({
    data: {
      authorId: me.id,
      title,
      summary: (body.summary ?? "").trim().slice(0, 280),
      tags: (body.tags ?? "").trim().slice(0, 120),
      blocks: sections as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, id: p.id });
}

/** فهرست مطالب خود نویسنده — برای پنل استاد */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  if (me.role !== "teacher" && me.role !== "admin")
    return NextResponse.json({ posts: [] });

  const rows = await db.post.findMany({
    where: { authorId: me.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, summary: true, tags: true, createdAt: true, _count: { select: { comments: true } } },
  });

  return NextResponse.json({
    posts: rows.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      tags: p.tags,
      createdAt: p.createdAt.toISOString(),
      commentsCount: p._count.comments,
    })),
  });
}
