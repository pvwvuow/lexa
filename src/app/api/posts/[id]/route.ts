import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { sanitizeSections, sanitizeQuiz, safeThumbnail, CATEGORY_SLUGS, safeCategories, parseCategories } from "@/lib/social-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** جزئیات کامل یک مطلب + کامنت‌ها */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionUser();

  const p = await db.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });
  if (!p) return NextResponse.json({ error: "مطلب یافت نشد." }, { status: 404 });

  return NextResponse.json({
    post: {
      id: p.id,
      title: p.title,
      summary: p.summary,
      tags: p.tags,
      category: p.category,
      categories: parseCategories(p.categories, p.category),
      thumbnail: p.thumbnail,
      quiz: (() => { try { return sanitizeQuiz(JSON.parse(p.quizJson)); } catch { return []; } })(),
      blocks: p.blocks,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      author: {
        id: p.author.id,
        username: p.author.username,
        displayName: p.author.displayName || p.author.username,
        bio: p.author.bio ?? "",
        avatarUrl: p.author.avatarUrl,
      },
      canManage: !!me && (me.id === p.authorId || me.role === "admin"),
    },
    comments: p.comments.map((c) => ({
      id: c.id,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
      replyToId: c.replyToId ?? null,
      userId: c.user.id,
      username: c.user.username,
      avatarUrl: c.user.avatarUrl,
    })),
  });
}

/** ویرایش مطلب — فقط نویسنده یا مدیر */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const p = await db.post.findUnique({ where: { id }, select: { authorId: true } });
  if (!p) return NextResponse.json({ error: "مطلب یافت نشد." }, { status: 404 });
  if (p.authorId !== me.id && me.role !== "admin")
    return NextResponse.json({ error: "اجازهٔ ویرایش این مطلب را ندارید." }, { status: 403 });

  let body: { title?: string; summary?: string; tags?: string; blocks?: unknown; category?: unknown; categories?: unknown; thumbnail?: unknown; quiz?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const sections = sanitizeSections(body.blocks);
  if (!sections.length) return NextResponse.json({ error: "دست‌کم یک بلوک محتوا لازم است." }, { status: 400 });

  const cats = safeCategories(body.categories ?? body.category);
  await db.post.update({
    where: { id },
    data: {
      title: (body.title ?? "").trim().slice(0, 140) || undefined,
      summary: typeof body.summary === "string" ? body.summary.trim().slice(0, 280) : undefined,
      tags: typeof body.tags === "string" ? body.tags.trim().slice(0, 120) : undefined,
      ...(typeof body.category === "string" || Array.isArray(body.categories)
        ? {
            category: typeof body.category === "string" && CATEGORY_SLUGS.includes(body.category)
              ? body.category
              : cats[0] ?? "",
            categories: JSON.stringify(cats),
          }
        : {}),
      // تصویر شاخص و آزمون دلخواه‌اند؛ ولی اگر در بدنه باشند (حتی خالی) جایگزین می‌شوند
      ...(body.thumbnail !== undefined ? { thumbnail: safeThumbnail(body.thumbnail) } : {}),
      ...(body.quiz !== undefined ? { quizJson: JSON.stringify(sanitizeQuiz(body.quiz)) } : {}),
      blocks: sections as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true });
}

/** حذف مطلب — نویسنده یا مدیر (کامنت‌ها با Cascade پاک می‌شوند) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const p = await db.post.findUnique({ where: { id }, select: { authorId: true } });
  if (!p) return NextResponse.json({ error: "مطلب یافت نشد." }, { status: 404 });
  if (p.authorId !== me.id && me.role !== "admin")
    return NextResponse.json({ error: "اجازهٔ حذف این مطلب را ندارید." }, { status: 403 });

  await db.comment.deleteMany({ where: { postId: id } });
  await db.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
